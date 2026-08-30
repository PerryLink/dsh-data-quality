# dsh-data-quality
- **Canal 1024 store**: `npm i -g dsh1024` uma vez, depois `dsh1024 plugin --profile web add dsh-data-quality` (conta para o ranking de instalações do [deepseek1024.com](https://deepseek1024.com)).

**Perfilamento, limpeza e verificação de dados determinísticos para DeepSeek Harness.**

Todo o cálculo é TypeScript puro no processo do harness — o modelo nunca faz as contas. Uma costura de capacidade `ctx.dataQuality` (Service Definition / Provider local / Consumers de ferramentas) expõe três ferramentas para o modelo mais um contrato congelado de verificação de citações entre plugins.

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

## Compatibility

| Componente | Versão |
|---|---|
| DeepSeek Harness | `0.1.1-rc.2` (dependências peer fixadas) |
| Node.js | `^22.19.0 \|\| >=24.0.0` |
| Gerenciador de pacotes | `pnpm@11.7.0` |
| Plataforma | Windows / macOS / Linux (plugin apenas de host) |

## What you get

- **Serviço `ctx.dataQuality`** — um serviço Cordis que outros plugins podem consumir opcionalmente (`inject = ['dataQuality']`). Além das três operações sobre datasets por trás das ferramentas, implementa o contrato congelado `verifyCitations(request)`: verifica se números/strings citados num documento batem com um instantâneo do dataset, com comparação numérica por tolerância relativa e estados `verified` / `mismatch` / `not-found` / `unverifiable`.
- **Ferramenta `data_profile`** — perfilamento de datasets: contagens de linhas/colunas, tipos de coluna inferidos (number/date/boolean/string/empty/mixed), taxas de ausência, contagens de valores únicos, distribuições numéricas (min/max/mean/median/p25/p75), contagem de outliers IQR, notas de suspeita de tipos mistos e contagem de linhas duplicadas da tabela inteira. Amostragem sistemática determinística opcional para arquivos grandes.
- **Ferramenta `data_clean`** — regras declarativas de limpeza em ordem: `dedupe` (por grupo de colunas), `fill-missing` (constant/mean/median/forward), `coerce-type` (number/date/boolean; falhas contadas e viram ausentes), `normalize-unit` (p. ex. sufixos 万/亿 para unidades base), `trim`, `map-values` (mapeamento de enumerações). Retorna um log de auditoria por regra mais uma prévia limitada; só grava o dataset limpo quando `outputPath` é dado e nunca sobrescreve a origem.
- **Ferramenta `data_verify`** — regras declarativas de verificação: `not-null`, `unique`, `range`, `regex`, `enum`, `cross-column` (p. ex. `startDate < endDate`), `freshness` (coluna de data dentro de N dias de uma data de referência). pass/fail por regra com evidência limitada de linhas falhas; uma falha geral é um resultado normal `passed: false`, não um erro de ferramenta.
- **Relatórios duráveis** — cada execução de perfilamento/limpeza/verificação/citações persiste no domínio de armazenamento `data_quality` (backend JSON), com chave de timestamp mais impressão digital do caminho do dataset; a chave é retornada como `reportKey` nos resultados. Os relatórios de limpeza também persistem a pré-visualização limitada, de modo que todo resultado visível ao modelo é reconstruível a partir do seu `reportKey`.
- **Eventos de sessão** — em hosts que os suportam com segurança, as execuções anexam eventos `data-quality/profile` / `data-quality/clean` / `data-quality/verify` (com a marca `ignorable` onde suportado). Em 0.1.1-rc.2 o append é omitido por design — o relatório do domínio de armazenamento é sempre a cópia durável (ver «Known limitations»).

## Quick start

### Canal npm

```sh
dsh plugin --profile web add dsh-data-quality
```

### Canal tarball (não precisa de permissão de build)

```sh
pnpm pack                                  # produz dsh-data-quality-<version>.tgz
dsh plugin --profile web add ./dsh-data-quality-<version>.tgz
```

### Canal git

```sh
dsh plugin --profile web add github:YOUR_ORG/dsh-data-quality#<commit-sha>
```

O primeiro `add` falha porque o pnpm bloqueia o build `prepare` do pacote; copie a chave exata que o pnpm imprimiu para o `pnpm-workspace.yaml` do profile e execute de novo:

```yaml
allowBuilds:
  'dsh-data-quality': true
```

Reinicie o profile após instalar (bundles ativam no reinício). Depois peça ao agente, num workspace com um CSV:

> Perfile `holdings.csv`, depois limpe-o aparando espaços, desduplicando por `fund_code` e normalizando as unidades 万/亿 da coluna `holding_value`; por fim verifique que `fund_code` é único e não nulo.

## Install & uninstall

```sh
dsh plugin --profile web add dsh-data-quality      # instalar (npm) — ou as formas acima
dsh plugin --profile web remove dsh-data-quality   # desinstalar
```

## Configuration

Todas as chaves são opcionais (valores padrão mostrados); valores inválidos falham ruidosamente no carregamento. Cada chave pode ser alterada no `cordis.yml` (o bundle inclui `cordis.patch.yml` com os mesmos padrões).

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | Interruptor mestre; `false` não monta nada. |
| `maxRows` | `200000` | Teto rígido de linhas por carga; entradas maiores são rejeitadas ruidosamente (use o parâmetro `sample` da ferramenta). |
| `maxFileSizeMB` | `64` | Teto rígido de tamanho de arquivo em MiB por carga. |
| `defaultTolerance` | `1e-9` | Tolerância relativa padrão para comparação numérica de citações quando a citação omite `tolerance`. |
| `evidenceRowLimit` | `20` | Teto de linhas de evidência (verify) e de prévia (clean) num resultado. |
| `allowedExtensions` | `['.csv', '.tsv', '.json', '.jsonl']` | Extensões aceitas como datasets. |
| `workspaceRoot` | `""` | Raiz absoluta para chamadas de nível de SERVIÇO (p. ex. `verifyCitations`) sem workspace de sessão; vazio = diretório de arranque do processo do harness. Ferramentas sempre usam o cwd do workspace da sessão. |
| `storeReports` | `true` | Persistir relatórios no domínio de armazenamento `data_quality` e retornar `reportKey`. |
| `scorecardWeights` | todo 1 (igual) | Pesos por dimensão (completeness/uniqueness/validity/consistency/timeliness/accuracy) para o total ponderado do scorecard; cada peso deve ser um número não negativo. |

## Tools & surfaces

### `data_profile({ path, sample?, industryPreset? })`

Perfilam um dataset do workspace. `path` é relativo ao workspace (`.csv`/`.tsv`/`.json`/`.jsonl`; JSON deve ser um array de objetos planos). `sample` toma cada `ceil(N/sample)`-ésima linha para os cartões de coluna (determinístico; as contagens de linhas continuam exatas). `industryPreset` (`retail`/`saas`/`fund`/`real-estate`/`e-commerce`/`healthcare`/`logistics`/`manufacturing`/`energy`) injeta as colunas esperadas dessa indústria para que a dimensão `accuracy` do scorecard seja determinável; ids desconhecidos falham alto. Retorna o relatório estruturado e renderiza um resumo legível por coluna.

### `data_clean({ path, rules, outputPath?, dryRun? })`

Aplica `rules` na ordem do array; cada regra vê a saída da anterior. Referência de regras:

| Regra | Campos extras | Semântica |
|---|---|---|
| `dedupe` | `columns?` | Remove linhas cuja combinação de colunas-chave duplica uma linha anterior (a primeira é mantida; todas as colunas se omitido). |
| `fill-missing` | `column`, `strategy`, `value?` | Preenche ausentes: `constant` (requer `value`), `mean`/`median` (colunas numéricas), `forward` (valor anterior não ausente). |
| `coerce-type` | `column`, `to` | Converte para `number`/`date` (ISO)/`boolean`; falhas viram ausentes e são contadas. |
| `normalize-unit` | `column`, `factors` | Remove o sufixo de unidade e multiplica (`{"万": 10000, "亿": 100000000}`); numéricos simples também convertem. |
| `trim` | `columns?` | Apara espaços de células de texto (todas as colunas se omitido). |
| `map-values` | `column`, `map`, `else?` | Mapeamento por correspondência exata; valores não mapeados ficam (`keep`, padrão) ou viram `missing`. |

O arquivo de origem **nunca** é sobrescrito. Com `outputPath` o dataset limpo é gravado lá (confinado ao workspace, formato por extensão); sem ele a execução é apenas prévia. Com `dryRun: true` nenhum arquivo é gravado e nada é persistido: o resultado devolve o plano de limpeza por coluna e o `contract`/`diffPreview` esperados. O resultado também carrega um resumo de `contract` pré-entrega, e um relatório de perfil `clean-diff` antes/depois é persistido no domínio de armazenamento.

### `data_report({ key?, kind?, format? })`

Lê relatórios persistidos do domínio de armazenamento. Passe `key` (o `reportKey` exato devolvido por uma execução anterior) para buscar um relatório, ou `kind` (`profile`/`clean`/`clean-diff`/`verify`/`citations`) para listar cronologicamente todos os relatórios desse tipo; exatamente um de `key`/`kind` é obrigatório. Chaves malformadas ou ausentes falham alto. `format: html` (com `key`) renderiza o relatório como um documento HTML offline autocontido: CSS/JS em linha, sem requisições externas, o scorecard DAMA de seis dimensões e as tabelas de resumo de perfil/limpeza (somente relatórios profile/clean).

### `data_verify({ path, rules, expectations? })`

Avalia regras de verificação. Referência de regras:

| Regra | Campos extras | Semântica |
|---|---|---|
| `not-null` | `column` | Falham células ausentes (null/vazio/só espaços). |
| `unique` | `columns` | Falha cada linha cuja combinação-chave se repete (ausentes participam). |
| `range` | `column`, `min?`, `max?` | Falham células ausentes/não parseáveis e valores fora dos limites inclusivos (pelo menos um limite obrigatório). |
| `regex` | `column`, `pattern`, `flags?` | Falham células ausentes ou não correspondentes (regex JS completa). |
| `enum` | `column`, `values` | Falham células cujo texto aparado não está na lista. |
| `cross-column` | `left`, `op`, `rightColumn?`, `value?` | Compara por linha: numérico quando ambos os lados parseiam, datas como épocas, strings só para `==`/`!=` (exatamente um de `rightColumn`/`value`). |
| `freshness` | `column`, `maxAgeDays`, `asOf?` | Falham datas mais velhas que `maxAgeDays` antes de `asOf` (padrão: agora); não parseável/ausente falha. |

Uma célula ausente faz falhar toda regra que a lê. A evidência é limitada a `evidenceRowLimit` linhas falhas por regra.

`expectations` reconcilia métricas determinísticas com valores esperados: `rowCount`, `columnSum`, `columnMean`, `uniqueCount`, `nullCount` (cada um com `column` exceto `rowCount`, mais `expected` e uma `tolerance` relativa opcional em [0, 1]). Cada expectativa produz `passed` mais `actual`/`expected`/`tolerance`; uma discrepância é um veredicto normal `passed: false`, nunca um erro de ferramenta. Métricas inválidas, colunas ausentes e tolerâncias fora de faixa falham alto.

### `ctx.dataQuality` (para outros plugins)

```ts
const result = await ctx.dataQuality.verifyCitations({
  dataset: 'holdings.csv',          // resolvido contra workspaceRoot
  citations: [
    { id: 'c1', path: 'rows[3].nav', value: 1.234, tolerance: 0.01 },
    { id: 'c2', path: 'summary.annualReturn', value: '12.34%' },
  ],
})
// result.results[i] = { id, status: 'verified' | 'mismatch' | 'not-found' | 'unverifiable', actual?, note? }
```

Os localizadores percorrem o documento do dataset: CSV/TSV carregam como `{ columns, rows }` (logo `rows[3].nav` resolve), JSON é o valor parseado, JSONL o array de linhas parseadas. Números comparam com tolerância relativa (`|a-b| <= tolerance * max(|a|, |b|)`); uma célula de texto CSV que parseia numericamente compara como número; strings comparam exatas; pares de tipos incomparáveis são `unverifiable`. O serviço também expõe `profileDataset` / `cleanDataset` / `verifyDataset` (as mesmas operações que as ferramentas chamam).

## Permissions & data

- **Lê** arquivos de dataset do workspace (apenas extensões permitidas).
- **Escreve** apenas: o arquivo de saída do `data_clean` (`outputPath` explícito, confinado ao workspace, nunca a entrada) e os relatórios do domínio de armazenamento `data_quality` no diretório de dados do harness.
- **Sem rede, sem credenciais, sem processos externos** — todo o parsing e a estatística são TypeScript em processo.
- Os relatórios podem conter valores de célula de amostra dos seus datasets (limitados por `evidenceRowLimit` e pelo truncamento de exibição); o log de sessão regista argumentos e resultados de ferramentas como de costume.

## Security boundaries

- **Confinamento de caminhos** — caminhos de dataset e saída devem resolver dentro do workspace de sessão (`verifyCitations` usa `workspaceRoot`); escapes `..` e caminhos absolutos fora da raiz são rejeitados, e ambos os lados são normalizados antes da comparação (seguro com barras do Windows).
- **Trabalho limitado** — as guardas `maxRows` / `maxFileSizeMB` rejeitam entradas sobredimensionadas ruidosamente; sinais de aborto cancelam cargas longas no meio.
- **Sem sobrescrita** — `data_clean` recusa um `outputPath` igual ao caminho de entrada.
- **Cálculo determinístico** — mesma entrada, mesma saída; o único relógio é o injetado para os padrões de `freshness` e os timestamps de relatórios.

## Known limitations

- **Os eventos de sessão são adaptativos.** 0.1.1-rc.2 não tem superfície de registo de eventos de sessão para plugins e o seu `Session.append` não consegue estampar a marca `ignorable`, logo anexar um tipo `data-quality/*` desconhecido tornaria o log de sessão ilegível ao restaurar. Por isso o plugin só anexa quando o host conhece o vocabulário ou suporta o flag `ignorable`; em rc.2 o relatório do domínio de armazenamento é o registo durável.
- **Dialeto CSV** — vírgula/tab com aspas RFC-4180, linha de cabeçalho obrigatória, linhas em branco ignoradas; sem autodetecção de delimitador nem linhas de comentário.
- **O parsing de tipos é estrito** — números sem separadores de milhares; datas são `YYYY-MM-DD` / `YYYY/MM/DD` / datetimes estilo ISO (UTC); booleanos são `true/false/yes/no/1/0`. Todo o resto é perfilado como `string`/`mixed` — limpe com `coerce-type` se for intencional.
- **JSON tem de ser tabular para as ferramentas** (array de objetos planos); `verifyCitations` percorre documentos JSON arbitrários.
- **Sem deteção de anomalias por ML, sem mascaramento de PII, sem bases de dados, sem SQL** — apenas notas de suspeita baseadas em regras.

## Development

```sh
pnpm install
pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build
pnpm run verify:self-contained && pnpm run verify:artifacts && pnpm run verify:readme-sync && pnpm pack
```

- Os testes correm vitest contra os `Context`/`Session`/`ToolRuntime`/domínio de armazenamento REAIS dos peers 0.1.1-rc.2 (sem mocks de serviços escritos à mão) mais specs de motores puros; cada regra de limpeza/verificação tem casos positivos e negativos, e `verifyCitations` cobre os quatro estados.
- `scripts/loader-runner.mjs` arranca a composição real do Loader e executa a cadeia perfilar → limpar → verificar contra `fixtures/` sem chave de API.
- Release: `node scripts/release.mjs <x.y.z>` (nunca faz push; a tag dispara `release.yml`).

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `data-quality` · `data-cleaning` · `data-profiling` · `data-verification`

## Contributors

Obrigado a todos os que deram forma a este plugin.

- **PerryLink** — manutenção e releases (`0.1.2`/`0.1.3`), atualizações de peer-dependencies, os selos npm version/downloads/CI, e correções recentes.
- **dsh-data-quality contributors** — o scaffold inicial, o seam `ctx.dataQuality` e o contrato congelado `verifyCitations`, a camada de datasets determinística e os motores puros, os relatórios do domínio de armazenamento `data_quality`, a suíte vitest com serviços reais, os fluxos CI/compat/release, e os READMEs em cinco línguas.

Este repositório ainda não tem histórico público de issues ou pull requests; os números de PR/issue serão creditados aqui quando surgirem.

## PerryLink DSH Plugin Family

Este plugin segue as convenções de engenharia partilhadas da família DSH: empacotamento com manifesto bundle (`dsh.bundle` + `cordis.patch.yml`), READMEs em cinco línguas com verificação de sincronia, configuração Schemastery de falha ruidosa, cobertura vitest com serviços reais e a cadeia de três fluxos CI/compat/release.

## PerryLink DSH Plugin Family

Este projeto é um dos [33 plugins de DeepSeek Harness](https://github.com/PerryLink) mantidos por [PerryLink](https://github.com/PerryLink). Se este ajuda você, os outros provavelmente também:

| Plugin | One-liner |
|---|---|
| **[dsh-dsh-auto-review](https://github.com/PerryLink/dsh-dsh-auto-review)** | Auto-revisão de segundo modelo na cadeia de aprovação, com falha fechada por padrão | |
| **[dsh-dsh-background-agents](https://github.com/PerryLink/dsh-dsh-background-agents)** | Agentes filhos em segundo plano duráveis com barra lateral de UI web, mensagens e interrupção | |
| **[dsh-dsh-budget](https://github.com/PerryLink/dsh-dsh-budget)** | Governança de custos para DeepSeek Harness: orçamentos, carbono e latência em um painel. | |
| **[dsh-dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-dsh-checkpoint-rewind)** | Equivalente ao /rewind do Claude Code: instantâneos, bifurcações de sessão, restauração de uso único | |
| **[dsh-dsh-claude-move](https://github.com/PerryLink/dsh-dsh-claude-move)** | Migre sessões, memória, habilidades e CLAUDE.md do Claude Code para o DSH | |
| **[dsh-dsh-click](https://github.com/PerryLink/dsh-dsh-click)** | Controle de desktop nativo multiplataforma para DeepSeek Harness — Windows primeiro. | |
| **[dsh-dsh-composer-history](https://github.com/PerryLink/dsh-dsh-composer-history)** | Histórico de entrada estilo terminal para o compositor web: setas, busca Ctrl+R | |
| **[dsh-dsh-defend](https://github.com/PerryLink/dsh-dsh-defend)** | Defesa contra injeção de prompt, jailbreak e vazamento de segredos para DeepSeek Harness. | |
| **[dsh-dsh-doublecheck](https://github.com/PerryLink/dsh-dsh-doublecheck)** | Guardião de disciplina de engenharia: sabatina de requisitos, portões de teste, revisão adversária | |
| **[dsh-dsh-draw](https://github.com/PerryLink/dsh-dsh-draw)** | Roteamento unificado de geração de imagens estáticas para DeepSeek Harness. | |
| **[dsh-dsh-fast](https://github.com/PerryLink/dsh-dsh-fast)** | Diagnóstico de desempenho só de leitura para DeepSeek Harness. | |
| **[dsh-dsh-fund-research](https://github.com/PerryLink/dsh-dsh-fund-research)** | Relatórios de pesquisa deterministas para fundos mútuos públicos chineses | |
| **[dsh-dsh-github](https://github.com/PerryLink/dsh-dsh-github)** | Integração de PR/issues do GitHub para o DSH, cada escrita controlada por aprovação | |
| **[dsh-dsh-industry-research](https://github.com/PerryLink/dsh-dsh-industry-research)** | Orquestração de pesquisa setorial que sela as suas entregas através do `ctx.researchReport.assemble` deste plugin | |
| **[dsh-dsh-library](https://github.com/PerryLink/dsh-dsh-library)** | Base de conhecimento documental local para DeepSeek Harness. | |
| **[dsh-dsh-local-ai](https://github.com/PerryLink/dsh-dsh-local-ai)** | Integração de modelos locais (Ollama) para DeepSeek Harness. | |
| **[dsh-dsh-lsp-actions](https://github.com/PerryLink/dsh-dsh-lsp-actions)** | Diagnósticos, formatação, autocompletar, ações de código e renomeação LSP sobre servidores de linguagem | |
| **[dsh-dsh-mask](https://github.com/PerryLink/dsh-dsh-mask)** | Middleware de mascaramento de PII: anonimiza no limite do modelo, restaura na camada de exibição | |
| **[dsh-dsh-mcp-panel](https://github.com/PerryLink/dsh-dsh-mcp-panel)** | Painel de tempo de execução MCP somente leitura: comando /mcp + aba Settings com status, ferramentas e erros | |
| **[dsh-dsh-memento](https://github.com/PerryLink/dsh-dsh-memento)** | Memória entre sessões controlada por aprovação: costura ctx.memory + SQLite + ferramenta de memória | |
| **[dsh-dsh-observe](https://github.com/PerryLink/dsh-dsh-observe)** | Exportador de observabilidade OpenTelemetry e Langfuse para DeepSeek Harness. | |
| **[dsh-dsh-output-styles](https://github.com/PerryLink/dsh-dsh-output-styles)** | Troca de estilo em tempo de execução equivalente ao outputStyles do Claude Code | |
| **[dsh-dsh-permission-rules](https://github.com/PerryLink/dsh-dsh-permission-rules)** | Regras de permissão declarativas allow/deny/ask estilo Claude Code com auditoria | |
| **[dsh-dsh-plugin-guide](https://github.com/PerryLink/dsh-dsh-plugin-guide)** | Base de conhecimento de desenvolvimento de plugins como habilidade de agente sob demanda | |
| **[dsh-dsh-research-report](https://github.com/PerryLink/dsh-dsh-research-report)** | Motor de relatórios de pesquisa verificáveis com evidência endereçada por conteúdo | |
| **[dsh-dsh-score](https://github.com/PerryLink/dsh-dsh-score)** | Pontuação de qualidade multidimensional para plugins de DeepSeek Harness. | |
| **[dsh-dsh-session-pin](https://github.com/PerryLink/dsh-dsh-session-pin)** | Fixe sessões na barra lateral web com ordenação durável | |
| **[dsh-dsh-session-sync](https://github.com/PerryLink/dsh-dsh-session-sync)** | Sincronização de sessões entre dispositivos para DeepSeek Harness — um espelho git dedicado do seu armazenamento de sessões. | |
| **[dsh-dsh-skill-pack-security](https://github.com/PerryLink/dsh-dsh-skill-pack-security)** | Pacote de habilidades de auditoria de segurança: varredura de segredos, revisão de dependências e cadeia de suprimentos | |
| **[dsh-dsh-talk](https://github.com/PerryLink/dsh-dsh-talk)** | Loop de sessão com voz para DeepSeek Harness: fale e ouça a resposta. | |
| **[dsh-dsh-test-drive](https://github.com/PerryLink/dsh-dsh-test-drive)** | Test drives isolados de instalação e smoke para plugins de DeepSeek Harness. | |
| **[dsh-dsh-translate](https://github.com/PerryLink/dsh-dsh-translate)** | Tradução de parâmetros entre fornecedores e reparo determinístico de JSON para DeepSeek Harness. | |

## License

Apache-2.0 — ver [LICENSE](LICENSE) e [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
