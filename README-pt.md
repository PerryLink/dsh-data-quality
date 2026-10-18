# dsh-data-quality

Perfilamento, limpeza e verificação de dados determinísticos para DeepSeek Harness.

- **Canal 1024 store**: `npm i -g dsh1024` uma vez, depois `dsh1024 plugin --profile web add dsh-data-quality` (conta para o ranking de instalações do [deepseek1024.com](https://deepseek1024.com)).

**Perfilamento, limpeza e verificação de dados determinísticos para DeepSeek Harness.**

Todo o cálculo é TypeScript puro no processo do harness — o modelo nunca faz as contas. Uma costura de capacidade `ctx.dataQuality` (Service Definition / Provider local / Consumers de ferramentas) expõe três ferramentas para o modelo mais um contrato congelado de verificação de citações entre plugins.

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

```sh
dsh plugin --profile <name> add dsh-data-quality
```

[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-data-quality.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-en.svg)](https://dsh.market/)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-data-quality)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-data-quality?metric=downloads&lang=pt)](https://dshfind.com/pt/plugins/PerryLink/dsh-data-quality?ref=badge)


**📖 Base de conhecimento do ecossistema** — dados medidos, não marketing: [guia de desenvolvimento · dados de seleção · critérios de manutenção](https://perrylink.github.io/dsh-plugin-guide/).

<!-- star-cta -->
## Install & uninstall

```sh
dsh plugin --profile web add dsh-data-quality      # instalar (npm) — ou as formas acima
dsh plugin --profile web remove dsh-data-quality   # desinstalar
```

## ⭐ 如果它帮到了你

Este plugin faz parte da [família de plugins DSH](https://github.com/PerryLink) (mais de 40, todos Apache-2.0). Se for útil, **deixe uma estrela**: não desbloqueia nada, mas ajuda a próxima pessoa a encontrá-lo.

*English:* part of a 40+ plugin family for DeepSeek Harness. If it is useful, **a star helps the next person find it** — nothing is gated behind it.

## What is dsh-data-quality?

Perfilamento, limpeza e verificação de dados determinísticos para DeepSeek Harness.

![Demonstração de terminal do dsh-data-quality: dsh-data-quality — data_profile over the repo's own dirty fixture](https://raw.githubusercontent.com/PerryLink/dsh-data-quality/main/docs/assets/dsh-data-quality-hero.png)

![Animated terminal demo of dsh-data-quality](https://raw.githubusercontent.com/PerryLink/dsh-data-quality/main/docs/assets/dsh-data-quality-demo.gif)

*A mesma execução, animada.*

## Comparison

![Gráfico comparativo medido do dsh-data-quality](https://raw.githubusercontent.com/PerryLink/dsh-data-quality/main/docs/assets/dsh-data-quality-evidence.png)

fixtures/dirty-fund-holdings.csv (10 rows x 6 columns) · 5 determinable dimensions · run locally

## Compatibility

| Componente | Versão |
|---|---|
| DeepSeek Harness | `dsh-v0.2.1-alpha.1` (adaptado em 2026-10-04): o intervalo de peers agora admite a linha alpha.2; nela o terceiro parâmetro de `Session.append` existe apenas para tipos de superfície e é um `SurfaceIntent`, então o portão de auditoria continua pulando e o relatório do domínio de armazenamento continua sendo a cópia durável. Verificado em 2026-09-24 (typecheck duplo + suíte completa verde). |
| Node.js | `^22.19.0 \|\| >=24.0.0` |
| Gerenciador de pacotes | `pnpm@11.7.0` |
| Plataforma | Windows / macOS / Linux (plugin apenas de host) |

## What you get

- **Serviço `ctx.dataQuality`** — um serviço Cordis que outros plugins podem consumir opcionalmente (`inject = ['dataQuality']`). Além das três operações sobre datasets por trás das ferramentas, implementa o contrato congelado `verifyCitations(request)`: verifica se números/strings citados num documento batem com um instantâneo do dataset, com comparação numérica por tolerância relativa e estados `verified` / `mismatch` / `not-found` / `unverifiable`.
- **Ferramenta `data_profile`** — perfilamento de datasets: contagens de linhas/colunas, tipos de coluna inferidos (number/date/boolean/string/empty/mixed), taxas de ausência, contagens de valores únicos, distribuições numéricas (min/max/mean/median/p25/p75), contagem de outliers IQR, notas de suspeita de tipos mistos e contagem de linhas duplicadas da tabela inteira. Amostragem sistemática determinística opcional para arquivos grandes.
- **Ferramenta `data_clean`** — regras declarativas de limpeza em ordem: `dedupe` (por grupo de colunas), `fill-missing` (constant/mean/median/forward), `coerce-type` (number/date/boolean; falhas contadas e viram ausentes), `normalize-unit` (p. ex. sufixos 万/亿 para unidades base), `trim`, `map-values` (mapeamento de enumerações). Retorna um log de auditoria por regra mais uma prévia limitada; só grava o dataset limpo quando `outputPath` é dado e nunca sobrescreve a origem.
- **Ferramenta `data_verify`** — regras declarativas de verificação: `not-null`, `unique`, `range`, `regex`, `enum`, `cross-column` (p. ex. `startDate < endDate`), `freshness` (coluna de data dentro de N dias de uma data de referência). pass/fail por regra com evidência limitada de linhas falhas; uma falha geral é um resultado normal `passed: false`, não um erro de ferramenta.
- **Relatórios duráveis** — cada execução de perfilamento/limpeza/verificação/citações persiste no domínio de armazenamento `data_quality` (backend JSON), com chave de timestamp mais impressão digital do caminho do dataset; a chave é retornada como `reportKey` nos resultados. Os relatórios de limpeza também persistem a pré-visualização limitada, de modo que todo resultado visível ao modelo é reconstruível a partir do seu `reportKey`.
- **Eventos de sessão** — em hosts que os suportam com segurança, as execuções anexam eventos `data-quality/profile` / `data-quality/clean` / `data-quality/verify` (com a marca `ignorable` onde suportado). Na linha publicada `0.1.7-rc.2` (como nas linhas rc anteriores) o append é omitido por design — o relatório do domínio de armazenamento é sempre a cópia durável (ver «Known limitations»).

## Quick start

```sh
dsh plugin --profile web add github:PerryLink/dsh-data-quality
```

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

- **Os eventos de sessão são adaptativos.** A linha publicada `0.1.7-rc.2` (como as linhas rc anteriores) não tem superfície de registo de eventos de sessão para plugins e o seu `Session.append` não consegue estampar a marca `ignorable`, logo anexar um tipo `data-quality/*` desconhecido tornaria o log de sessão ilegível ao restaurar. Por isso o plugin só anexa quando o host conhece o vocabulário ou suporta o flag `ignorable`; na linha publicada o relatório do domínio de armazenamento é o registo durável.
- **Dialeto CSV** — vírgula/tab com aspas RFC-4180, linha de cabeçalho obrigatória, linhas em branco ignoradas; sem autodetecção de delimitador nem linhas de comentário.
- **O parsing de tipos é estrito** — números sem separadores de milhares; datas são `YYYY-MM-DD` / `YYYY/MM/DD` / datetimes estilo ISO (UTC); booleanos são `true/false/yes/no/1/0`. Todo o resto é perfilado como `string`/`mixed` — limpe com `coerce-type` se for intencional.
- **JSON tem de ser tabular para as ferramentas** (array de objetos planos); `verifyCitations` percorre documentos JSON arbitrários.
- **Sem deteção de anomalias por ML, sem mascaramento de PII, sem bases de dados, sem SQL** — apenas notas de suspeita baseadas em regras.

## Development

```sh
pnpm install
pnpm run typecheck && pnpm run typecheck:ci && pnpm run typecheck:checkout && pnpm test && pnpm run build
pnpm run verify:self-contained && pnpm run verify:artifacts && pnpm run verify:readme-sync && pnpm pack
```

- Os testes correm vitest contra os `Context`/`Session`/`ToolRuntime`/domínio de armazenamento REAIS dos peers 0.1.7-rc.2 (sem mocks de serviços escritos à mão) mais specs de motores puros; cada regra de limpeza/verificação tem casos positivos e negativos, e `verifyCitations` cobre os quatro estados.
- `scripts/loader-runner.mjs` arranca a composição real do Loader e executa a cadeia perfilar → limpar → verificar contra `fixtures/` sem chave de API.
- Release: `node scripts/release.mjs <x.y.z>` (nunca faz push; a tag dispara `release.yml`).

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `data-quality` · `data-cleaning` · `data-profiling` · `data-verification`

## Contributors

Obrigado a todos os que deram forma a este plugin.

- **PerryLink** — manutenção e releases (`0.1.2`/`0.1.3`), atualizações de peer-dependencies, os selos npm version/downloads/CI, e correções recentes.
- **dsh-data-quality contributors** — o scaffold inicial, o seam `ctx.dataQuality` e o contrato congelado `verifyCitations`, a camada de datasets determinística e os motores puros, os relatórios do domínio de armazenamento `data_quality`, a suíte vitest com serviços reais, os fluxos CI/compat/release, e os READMEs em cinco línguas.

Este repositório ainda não tem histórico público de issues ou pull requests; os números de PR/issue serão creditados aqui quando surgirem.

## Família de plugins DSH da PerryLink

Este projeto é um dos **87 plugins ativamente mantidos** do DeepSeek Harness da [PerryLink](https://github.com/PerryLink). O registro da família tem **95** plugins — **5 congelados**, **3 retirados** — e fica recolhido abaixo para que cada README mantenha uma primeira tela curta. Expanda para ver cada linha, com o motivo na coluna Status.

<details>
<summary>Expandir os 95 plugins</summary>

| Plugin | Uma linha | Status |
|---|---|---|
| **[dsh-aqua-input-check](https://github.com/PerryLink/dsh-aqua-input-check)** | 水产养殖投入品记录核对（按投入品用量、休药期与起捕间隔核对记录自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-archive-check](https://github.com/PerryLink/dsh-archive-check)** | 档案归档完整性与保管期限核对（依据《档案法》及配套规定，仅提示差异，不作出定性结论） |  |
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default |  |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command |  |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-bid-ca-precheck](https://github.com/PerryLink/dsh-bid-ca-precheck)** | 投标文件符合性预检（按招标文件逐条核对响应情况，仅提示差异，不作出定性结论） |  |
| **[dsh-bid-qual-check](https://github.com/PerryLink/dsh-bid-qual-check)** | 投标人资格条件核对（按资格条件与证明材料核对逐条响应，仅提示差异，不作出定性结论） |  |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence |  |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore |  |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. |  |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search |  |
| **[dsh-contract-stance](https://github.com/PerryLink/dsh-contract-stance)** | 合同条款立场台账核对（按立场、风险等级与退让底线核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-customs-doc-check](https://github.com/PerryLink/dsh-customs-doc-check)** | 报关单证一致性核对（按公开的报关单填制规范核对单证间字段一致性，仅提示差异，不作出定性结论） |  |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) |  |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-demurrage-ledger](https://github.com/PerryLink/dsh-demurrage-ledger)** | 滞箱费台账核对（按免箱期与费率核对超期天数与金额的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review |  |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-drill-script-check](https://github.com/PerryLink/dsh-drill-script-check)** | 应急演练脚本核对（按阶段、响应分级、指挥与资源要素核对脚本齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-eia-guide-check](https://github.com/PerryLink/dsh-eia-guide-check)** | 环评导则适用性核对（按要素、导则名称与执行标准核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-emergency-plan](https://github.com/PerryLink/dsh-emergency-plan)** | 应急预案要素齐备性与条款级页码定位（依据 GB/T 29639-2020 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-essay-rubric-check](https://github.com/PerryLink/dsh-essay-rubric-check)** | 作文量表评分核对（按评分项、原文定位与分值算术核对评分自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-evidence-check](https://github.com/PerryLink/dsh-evidence-check)** | 证据清单齐备性核对（按待证事实与证据要素核对清单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-export-ctl-check](https://github.com/PerryLink/dsh-export-ctl-check)** | 出口管制物项核对（按管制清单、最终用途与许可证核对台账齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. |  |
| **[dsh-fmea-table-check](https://github.com/PerryLink/dsh-fmea-table-check)** | FMEA 分析表要素齐备性与风险顺序数一致性核对（按公开的 FMEA 方法标准核对表内自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-forecast-penalty](https://github.com/PerryLink/dsh-forecast-penalty)** | 预测准确率考核核对（按准确率、门槛与考核单价核对考核费用的算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds |  |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval |  |
| **[dsh-gongwen-flow-check](https://github.com/PerryLink/dsh-gongwen-flow-check)** | 公文流转与办理时限核对（按公开的公文处理规范核对环节完整性与时限，仅提示差异，不作出定性结论） |  |
| **[dsh-gongwen-word-check](https://github.com/PerryLink/dsh-gongwen-word-check)** | 公文格式要素核对（按公开的党政机关公文格式标准核对版头与主体要素，仅提示差异，不作出定性结论） |  |
| **[dsh-guard-plan-qc](https://github.com/PerryLink/dsh-guard-plan-qc)** | 劳动保护与安全防护用品配置表核对（按公开的配备标准核对品名规格与配置数量，仅提示差异，不作出定性结论） |  |
| **[dsh-hazchem-check](https://github.com/PerryLink/dsh-hazchem-check)** | 危险化学品临界量与重大危险源辨识核对（按储存量与临界量核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-hazplan-check](https://github.com/PerryLink/dsh-hazplan-check)** | HAZOP 分析表要素齐备性与偏差推导一致性核对（依据公开的危险与可操作性分析标准，仅提示差异，不作出定性结论） |  |
| **[dsh-hidden-risk-map](https://github.com/PerryLink/dsh-hidden-risk-map)** | 安全隐患台账→《工贸企业重大事故隐患判定标准》（应急管理部令第10号）条款映射提示（仅提示差异，不作出定性结论） |  |
| **[dsh-hs-classify](https://github.com/PerryLink/dsh-hs-classify)** | 商品归类层级一致性核对（按章、品目、子目与商品编号的层级关系核对自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-icd-rule-check](https://github.com/PerryLink/dsh-icd-rule-check)** | ICD 合并编码与星剑号配对提示（依据 GB/T 14396-2016 与公开的 ICD 使用说明，仅提示差异，不作出定性结论） |  |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` |  |
| **[dsh-lawcite-adapter](https://github.com/PerryLink/dsh-lawcite-adapter)** | 法条引用与文书要素核对（按名称、条号、原文与效力状态核对引用可核验性，仅提示差异，不作出定性结论） |  |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools |  |
| **[dsh-lc-doc-check](https://github.com/PerryLink/dsh-lc-doc-check)** | 信用证单据条款核对（按单据种类、份数、期限与不符点核对交单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-learning-gap-check](https://github.com/PerryLink/dsh-learning-gap-check)** | 能力差距与培养计划核对（按能力等级差、培养措施与完成期限核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base for DeepSeek Harness. |  |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. |  |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers |  |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer |  |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors |  |
| **[dsh-medrec-qc](https://github.com/PerryLink/dsh-medrec-qc)** | 病案首页形式质控与逻辑矛盾提示（依据国卫办医发〔2016〕24号等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool |  |
| **[dsh-nsfc-form-check](https://github.com/PerryLink/dsh-nsfc-form-check)** | 国家自然科学基金申请书形式审查与匿名化提示（依据《国家自然科学基金条例》与申请人导入的当年指南，仅提示差异，不作出定性结论） |  |
| **[dsh-nurse-record-check](https://github.com/PerryLink/dsh-nurse-record-check)** | 护理记录时限、签名与评估表完整性校验（依据《病历书写基本规范》等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. |  |
| **[dsh-origin-rvc-check](https://github.com/PerryLink/dsh-origin-rvc-check)** | 原产地区域价值成分核对（按 RVC 定义式与门槛核对原产地判定自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-ota-review-check](https://github.com/PerryLink/dsh-ota-review-check)** | 在线点评回复台账核对（按回复时限、问题分类与整改状态核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching |  |
| **[dsh-paper-doc-adapter](https://github.com/PerryLink/dsh-paper-doc-adapter)** | 试卷解析结构核对（按题型、答案、分值与 yotta 标识核对试卷结构自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit |  |
| **[dsh-permit-report-check](https://github.com/PerryLink/dsh-permit-report-check)** | 行政许可办理核对（按申请材料、法定时限与决定记录核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-pipeline-check](https://github.com/PerryLink/dsh-pipeline-check)** | 项目全流程文件链条核对（按环节先后与金额口径核对链条自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-pleading-draft](https://github.com/PerryLink/dsh-pleading-draft)** | 起诉状要素齐备性核对（按诉请、事实、证据、法条四要素核对文书齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins |  |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill |  |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins |  |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card |  |
| **[dsh-policy-brief-draft](https://github.com/PerryLink/dsh-policy-brief-draft)** | 政策专报要素核对（按观点、依据、出处与建议核对专报齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-power-loss-split](https://github.com/PerryLink/dsh-power-loss-split)** | 线损电量拆分与考核表核对（依据公开的线损计算口径，仅提示差异，不作出定性结论） |  |
| **[dsh-power-ticket-check](https://github.com/PerryLink/dsh-power-ticket-check)** | 电力工作票要素齐备性与签发许可顺序核对（依据现行电力安全工作规程，仅提示差异，不作出定性结论） |  |
| **[dsh-ppap-check](https://github.com/PerryLink/dsh-ppap-check)** | PPAP 提交要素齐备性核对（按公开的 PPAP 手册与提交等级核对要素齐备与版本填写，仅提示差异，不作出定性结论） |  |
| **[dsh-protest-deadline](https://github.com/PerryLink/dsh-protest-deadline)** | 质疑与投诉期限核对（按公开的政府采购质疑投诉规定核对期限与台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-railway-window](https://github.com/PerryLink/dsh-railway-window)** | 铁路施工天窗台账核对（按时间窗、时长算术与命令号核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-repair-order-qc](https://github.com/PerryLink/dsh-repair-order-qc)** | 维修工单结算核对（按项目金额、配件工时合计与结算总额核对算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions |  |
| **[dsh-review-reply-check](https://github.com/PerryLink/dsh-review-reply-check)** | 审稿意见逐条回应覆盖核对（按意见与回应一一对应核对覆盖完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-rulefile-check](https://github.com/PerryLink/dsh-rulefile-check)** | 规则库文件自检核对（按条款引用纪律与效力上限核对规则库自身合规，仅提示差异，不作出定性结论） |  |
| **[dsh-safety-brief-check](https://github.com/PerryLink/dsh-safety-brief-check)** | 安全技术交底记录要素齐备性与签字闭环核对（依据公开的安全生产法规与检查标准，仅提示差异，不作出定性结论） |  |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. |  |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. |  |
| **[dsh-site-log-check](https://github.com/PerryLink/dsh-site-log-check)** | 监理日志跨日连续性与旁站覆盖提示（依据 GB/T 50319-2013 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review |  |
| **[dsh-soe-decision-check](https://github.com/PerryLink/dsh-soe-decision-check)** | 三重一大决策台账核对（按前置研究、会议审议与决议记录核对程序留痕，仅提示差异，不作出定性结论） |  |
| **[dsh-soilwater-check](https://github.com/PerryLink/dsh-soilwater-check)** | 土壤与地下水监测台账核对（按点位、监测项目、限值与超标判定核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-sop-sync-check](https://github.com/PerryLink/dsh-sop-sync-check)** | 作业规程与 FMEA／控制计划一致性核对（按编号与版本核对三份文件是否同步，仅提示差异，不作出定性结论） |  |
| **[dsh-spc-gbt-adapter](https://github.com/PerryLink/dsh-spc-gbt-adapter)** | 控制图常数与过程能力指数核对（按 GB/T 4091 的常规控制图常数表核对控制限与 Cp/Cpk 的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. |  |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-tender-extract](https://github.com/PerryLink/dsh-tender-extract)** | 招标文件条款摘录核对（按出处与原文逐字核对摘录完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-tender-matrix](https://github.com/PerryLink/dsh-tender-matrix)** | 评标因素评分矩阵核对（按分值上限与合计核对矩阵自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. |  |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools |  |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. |  |
| **[dsh-warranty-calc](https://github.com/PerryLink/dsh-warranty-calc)** | 质保期与索赔金额核对（按质保期月数与里程、索赔金额算式核对自洽，仅提示差异，不作出定性结论） |  |

</details>

</details>