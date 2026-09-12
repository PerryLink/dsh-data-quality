# dsh-data-quality
- **Canal 1024 store**: `npm i -g dsh1024` una vez, luego `dsh1024 plugin --profile web add dsh-data-quality` (cuenta para el ranking de instalaciones de [deepseek1024.com](https://deepseek1024.com)).

**Perfilado, limpieza y verificación de datos deterministas para DeepSeek Harness.**

Todo el cálculo es TypeScript puro dentro del proceso del harness — el modelo nunca hace las cuentas. Una costura de capacidad `ctx.dataQuality` (Service Definition / Provider local / Consumers de herramientas) expone tres herramientas para el modelo más un contrato congelado de verificación de citas entre plugins.

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-data-quality.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-data-quality)

## Compatibility

| Componente | Versión |
|---|---|
| DeepSeek Harness | `dsh-v0.1.5-rc.2` (adaptado el 2026-09-10): el sobre de sesión conserva su campo ignorable solo para compatibilidad de lectura de logs almacenados - Session.append aún no puede estamparlo, por lo que el comportamiento de la puerta no cambia. Verificado el 2026-09-11 contra el master checkout dsh-v0.1.5-rc.2 (cadena completa de puertas + smoke de instalación de perfil). |
| Node.js | `^22.19.0 \|\| >=24.0.0` |
| Gestor de paquetes | `pnpm@11.7.0` |
| Plataforma | Windows / macOS / Linux (plugin solo de host) |

## What you get

- **Servicio `ctx.dataQuality`** — un servicio Cordis que otros plugins pueden consumir opcionalmente (`inject = ['dataQuality']`). Además de las tres operaciones sobre datasets detrás de las herramientas, implementa el contrato congelado `verifyCitations(request)`: verifica que los números/cadenas citados en un documento coincidan con una instantánea del dataset, con comparación numérica por tolerancia relativa y estados `verified` / `mismatch` / `not-found` / `unverifiable`.
- **Herramienta `data_profile`** — perfilado de datasets: conteos de filas/columnas, tipos de columna inferidos (number/date/boolean/string/empty/mixed), tasas de valores faltantes, conteos de valores únicos, distribuciones numéricas (min/max/mean/median/p25/p75), conteo de valores atípicos IQR, notas de sospecha por tipos mixtos y conteo de filas duplicadas de la tabla completa. Muestreo sistemático determinista opcional para archivos grandes.
- **Herramienta `data_clean`** — reglas declarativas de limpieza en orden: `dedupe` (por grupo de columnas), `fill-missing` (constant/mean/median/forward), `coerce-type` (number/date/boolean; los fallos se cuentan y quedan como faltantes), `normalize-unit` (p. ej. sufijos 万/亿 a unidades base), `trim`, `map-values` (mapeo de enumeraciones). Devuelve un registro de auditoría por regla más una vista previa acotada; solo escribe el dataset limpio cuando se indica `outputPath` y nunca sobrescribe el origen.
- **Herramienta `data_verify`** — reglas declarativas de verificación: `not-null`, `unique`, `range`, `regex`, `enum`, `cross-column` (p. ej. `startDate < endDate`), `freshness` (columna de fecha dentro de N días de una fecha de referencia). pass/fail por regla con evidencia acotada de filas fallidas; un fallo global es un resultado normal `passed: false`, no un error de herramienta.
- **Informes duraderos** — cada ejecución de perfilado/limpieza/verificación/citas persiste en el dominio de almacenamiento `data_quality` (backend JSON), con clave de marca de tiempo más huella de la ruta del dataset; la clave se devuelve como `reportKey` en los resultados. Los informes de limpieza también persisten la vista previa acotada, de modo que todo resultado visible para el modelo es reconstruible a partir de su `reportKey`.
- **Eventos de sesión** — en hosts que los soportan con seguridad, las ejecuciones añaden eventos `data-quality/profile` / `data-quality/clean` / `data-quality/verify` (con la marca `ignorable` donde se admite). En la línea publicada `0.1.2-rc.1` (como en las líneas rc anteriores) el append se omite por diseño — el informe del dominio de almacenamiento es siempre la copia duradera (véase «Known limitations»).

## Quick start

### Canal npm

```sh
dsh plugin --profile web add dsh-data-quality
```

### Canal tarball (no requiere permiso de compilación)

```sh
pnpm pack                                  # produce dsh-data-quality-<version>.tgz
dsh plugin --profile web add ./dsh-data-quality-<version>.tgz
```

### Canal git

```sh
dsh plugin --profile web add github:YOUR_ORG/dsh-data-quality#<commit-sha>
```

El primer `add` falla porque pnpm bloquea la compilación `prepare` del paquete; copia la clave exacta que pnpm imprimió en el `pnpm-workspace.yaml` del perfil y vuelve a ejecutar:

```yaml
allowBuilds:
  'dsh-data-quality': true
```

Reinicia el perfil tras instalar (los bundles se activan al reiniciar). Luego pide al agente, en un workspace que contenga un CSV:

> Perfila `holdings.csv`, luego límpialo recortando espacios, deduplicando por `fund_code` y normalizando las unidades 万/亿 de la columna `holding_value`; finalmente verifica que `fund_code` sea único y no nulo.

## Install & uninstall

```sh
dsh plugin --profile web add dsh-data-quality      # instalar (npm) — o las formas anteriores
dsh plugin --profile web remove dsh-data-quality   # desinstalar
```

## Configuration

Todas las claves son opcionales (se muestran los valores por defecto); los valores inválidos fallan ruidosamente al cargar. Cada clave se puede cambiar desde `cordis.yml` (el bundle incluye `cordis.patch.yml` con los mismos valores).

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | Interruptor maestro; `false` no monta nada. |
| `maxRows` | `200000` | Tope duro de filas por carga; entradas mayores se rechazan ruidosamente (usa el parámetro `sample` de la herramienta). |
| `maxFileSizeMB` | `64` | Tope duro de tamaño de archivo en MiB por carga. |
| `defaultTolerance` | `1e-9` | Tolerancia relativa por defecto para la comparación numérica de citas cuando la cita omite `tolerance`. |
| `evidenceRowLimit` | `20` | Tope de filas de evidencia (verify) y de vista previa (clean) en un resultado. |
| `allowedExtensions` | `['.csv', '.tsv', '.json', '.jsonl']` | Extensiones aceptadas como datasets. |
| `workspaceRoot` | `""` | Raíz absoluta para llamadas a nivel de SERVICIO (p. ej. `verifyCitations`) sin workspace de sesión; vacío = directorio de arranque del proceso del harness. Las herramientas siempre usan el cwd del workspace de la sesión. |
| `storeReports` | `true` | Persistir los informes en el dominio de almacenamiento `data_quality` y devolver `reportKey`. |
| `scorecardWeights` | todo 1 (igual) | Ponderaciones por dimensión (completeness/uniqueness/validity/consistency/timeliness/accuracy) para el total ponderado del scorecard; cada peso debe ser un número no negativo. |

## Tools & surfaces

### `data_profile({ path, sample?, industryPreset? })`

Perfila un dataset del workspace. `path` es relativo al workspace (`.csv`/`.tsv`/`.json`/`.jsonl`; JSON debe ser un array de objetos planos). `sample` toma cada `ceil(N/sample)`-ésima fila para las tarjetas de columna (determinista; los conteos de filas siguen siendo exactos). `industryPreset` (`retail`/`saas`/`fund`/`real-estate`/`e-commerce`/`healthcare`/`logistics`/`manufacturing`/`energy`) inyecta las columnas esperadas de esa industria para que la dimensión `accuracy` del scorecard sea determinable; los ids desconocidos fallan alto. Devuelve el informe estructurado y renderiza un resumen legible por columna.

### `data_clean({ path, rules, outputPath?, dryRun? })`

Aplica `rules` en orden de array; cada regla ve la salida de la anterior. Referencia de reglas:

| Regla | Campos extra | Semántica |
|---|---|---|
| `dedupe` | `columns?` | Elimina filas cuya combinación de columnas clave duplica una fila anterior (se conserva la primera; todas las columnas si se omite). |
| `fill-missing` | `column`, `strategy`, `value?` | Rellena faltantes: `constant` (requiere `value`), `mean`/`median` (columnas numéricas), `forward` (valor anterior no faltante). |
| `coerce-type` | `column`, `to` | Convierte a `number`/`date` (ISO)/`boolean`; los fallos quedan como faltantes y se cuentan. |
| `normalize-unit` | `column`, `factors` | Quita el sufijo de unidad y multiplica (`{"万": 10000, "亿": 100000000}`); los numéricos planos también se convierten. |
| `trim` | `columns?` | Recorta espacios en celdas de texto (todas las columnas si se omite). |
| `map-values` | `column`, `map`, `else?` | Mapeo por coincidencia exacta; los valores no mapeados se conservan (`keep`, por defecto) o quedan `missing`. |

El archivo de origen **nunca** se sobrescribe. Con `outputPath` el dataset limpio se escribe allí (confinado al workspace, formato por extensión); sin él la ejecución es solo vista previa. Con `dryRun: true` no se escribe ningún archivo ni se persiste nada: el resultado devuelve el plan de limpieza por columna y el `contract`/`diffPreview` esperados. El resultado también lleva un resumen de `contract` previo a la entrega, y un informe de perfil `clean-diff` antes/después se persiste en el dominio de almacenamiento.

### `data_report({ key?, kind?, format? })`

Lee informes persistidos del dominio de almacenamiento. Pasa `key` (el `reportKey` exacto que devolvió una ejecución anterior) para obtener un informe, o `kind` (`profile`/`clean`/`clean-diff`/`verify`/`citations`) para listar cronológicamente todos los informes de ese tipo; se requiere exactamente uno de `key`/`kind`. Las claves malformadas o ausentes fallan alto. `format: html` (con `key`) renderiza el informe como un documento HTML offline autocontenido: CSS/JS en línea, sin peticiones externas, el scorecard DAMA de seis dimensiones y las tablas de resumen de perfil/limpieza (solo informes profile/clean).

### `data_verify({ path, rules, expectations? })`

Evalúa reglas de verificación. Referencia de reglas:

| Regla | Campos extra | Semántica |
|---|---|---|
| `not-null` | `column` | Fallan las celdas faltantes (null/vacío/solo espacios). |
| `unique` | `columns` | Falla cada fila cuya combinación clave se repite (los faltantes participan). |
| `range` | `column`, `min?`, `max?` | Fallan celdas faltantes/no parseables y valores fuera de los límites inclusivos (se requiere al menos un límite). |
| `regex` | `column`, `pattern`, `flags?` | Fallan celdas faltantes o que no coinciden (regex JS completa). |
| `enum` | `column`, `values` | Fallan celdas cuyo texto recortado no está en la lista. |
| `cross-column` | `left`, `op`, `rightColumn?`, `value?` | Compara por fila: numérico si ambos lados parsean, fechas como épocas, cadenas solo para `==`/`!=` (exactamente uno de `rightColumn`/`value`). |
| `freshness` | `column`, `maxAgeDays`, `asOf?` | Fallan fechas más viejas que `maxAgeDays` antes de `asOf` (por defecto: ahora); no parseable/faltante falla. |

Una celda faltante hace fallar toda regla que la lee. La evidencia se limita a `evidenceRowLimit` filas fallidas por regla.

`expectations` reconcilia métricas deterministas con valores esperados: `rowCount`, `columnSum`, `columnMean`, `uniqueCount`, `nullCount` (cada uno con `column` salvo `rowCount`, más `expected` y una `tolerance` relativa opcional en [0, 1]). Cada expectativa produce `passed` más `actual`/`expected`/`tolerance`; una discrepancia es un veredicto normal `passed: false`, nunca un error de herramienta. Métricas inválidas, columnas ausentes y tolerancias fuera de rango fallan alto.

### `ctx.dataQuality` (para otros plugins)

```ts
const result = await ctx.dataQuality.verifyCitations({
  dataset: 'holdings.csv',          // se resuelve contra workspaceRoot
  citations: [
    { id: 'c1', path: 'rows[3].nav', value: 1.234, tolerance: 0.01 },
    { id: 'c2', path: 'summary.annualReturn', value: '12.34%' },
  ],
})
// result.results[i] = { id, status: 'verified' | 'mismatch' | 'not-found' | 'unverifiable', actual?, note? }
```

Los localizadores recorren el documento del dataset: CSV/TSV cargan como `{ columns, rows }` (así `rows[3].nav` resuelve), JSON es el valor parseado, JSONL el array de líneas parseadas. Los números comparan con tolerancia relativa (`|a-b| <= tolerance * max(|a|, |b|)`); una celda de texto CSV que parsea numéricamente compara como número; las cadenas comparan exactas; los pares de tipos incomparables son `unverifiable`. El servicio también expone `profileDataset` / `cleanDataset` / `verifyDataset` (las mismas operaciones que llaman las herramientas).

## Permissions & data

- **Lee** archivos de dataset del workspace (solo extensiones permitidas).
- **Escribe** solo: el archivo de salida de `data_clean` (`outputPath` explícito, confinado al workspace, nunca la entrada) y los informes del dominio de almacenamiento `data_quality` en el directorio de datos del harness.
- **Sin red, sin credenciales, sin procesos externos** — todo el parseo y la estadística son TypeScript en proceso.
- Los informes pueden contener valores de celda de muestra de tus datasets (acotados por `evidenceRowLimit` y el truncado de presentación); el registro de sesión registra argumentos y resultados de herramientas como siempre.

## Security boundaries

- **Confinamiento de rutas** — las rutas de dataset y salida deben resolverse dentro del workspace de sesión (`verifyCitations` usa `workspaceRoot`); se rechazan escapes `..` y rutas absolutas fuera de la raíz, y ambos lados se normalizan antes de comparar (seguro con barras de Windows).
- **Trabajo acotado** — las guardas `maxRows` / `maxFileSizeMB` rechazan entradas sobredimensionadas ruidosamente; las señales de aborto cancelan cargas largas a mitad de camino.
- **Sin sobrescritura** — `data_clean` rechaza un `outputPath` igual a la ruta de entrada.
- **Cálculo determinista** — misma entrada, misma salida; el único reloj es el inyectado para los valores por defecto de `freshness` y las marcas de tiempo de informes.

## Known limitations

- **Los eventos de sesión son adaptativos.** La línea publicada `0.1.2-rc.1` (como las líneas rc anteriores) no tiene superficie de registro de eventos de sesión para plugins y su `Session.append` no puede estampar la marca `ignorable`, así que añadir un tipo `data-quality/*` desconocido haría ilegible el registro de sesión al restaurarlo. Por eso el plugin solo añade cuando el host conoce el vocabulario o soporta el flag `ignorable`; en la línea publicada el informe del dominio de almacenamiento es el registro duradero.
- **Dialecto CSV** — coma/tab con comillas RFC-4180, fila de cabecera obligatoria, líneas en blanco omitidas; sin autodetección de delimitador ni líneas de comentario.
- **El parseo de tipos es estricto** — los números no llevan separadores de miles; las fechas son `YYYY-MM-DD` / `YYYY/MM/DD` / datetimes estilo ISO (UTC); los booleanos son `true/false/yes/no/1/0`. Todo lo demás se perfila como `string`/`mixed` — límpialo con `coerce-type` si es intencionado.
- **JSON debe ser tabular para las herramientas** (array de objetos planos); `verifyCitations` recorre documentos JSON arbitrarios.
- **Sin detección de anomalías por ML, sin enmascarado de PII, sin bases de datos, sin SQL** — solo notas de sospecha basadas en reglas.

## Development

```sh
pnpm install
pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build
pnpm run verify:self-contained && pnpm run verify:artifacts && pnpm run verify:readme-sync && pnpm pack
```

- Las pruebas ejecutan vitest contra los `Context`/`Session`/`ToolRuntime`/dominio de almacenamiento REALES de los peers 0.1.5-rc.2 (sin mocks de servicios escritos a mano) más specs de motor puros; cada regla de limpieza/verificación tiene casos positivos y negativos, y `verifyCitations` cubre los cuatro estados.
- `scripts/loader-runner.mjs` arranca la composición real del Loader y ejecuta la cadena perfilar → limpiar → verificar contra `fixtures/` sin clave de API.
- Release: `node scripts/release.mjs <x.y.z>` (nunca hace push; el tag dispara `release.yml`).

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `data-quality` · `data-cleaning` · `data-profiling` · `data-verification`

## Contributors

Gracias a todas las personas que han dado forma a este plugin.

- **PerryLink** — mantenimiento y releases (`0.1.2`/`0.1.3`), mejoras de peer-dependencies, las insignias de npm version/downloads/CI, y correcciones recientes.
- **dsh-data-quality contributors** — el scaffold inicial, el seam `ctx.dataQuality` y el contrato congelado `verifyCitations`, la capa de datasets determinista y los motores puros, los informes del dominio de almacenamiento `data_quality`, la suite vitest con servicios reales, los flujos CI/compat/release, y los READMEs en cinco idiomas.

Este repositorio aún no tiene historial público de issues o pull requests; aquí se acreditarán los números de PR/issue cuando lleguen.

## PerryLink DSH Plugin Family

| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | |

| Plugin | One-liner |
|---|---|
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default | |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command | |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | |
| **[dsh-catalog](https://github.com/PerryLink/dsh-catalog)** | DSH Desktop Market standard catalog source for the PerryLink family | |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence | |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Unified session + workspace + config checkpoints with one-shot `/rewind` | |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code, Codex, OpenCode and Hermes sessions, memories and skills into DSH | |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. | |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search | |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review | |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics: load, spill, compaction and cache hit rate | |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Chinese mutual-fund research with sealed, traceable source snapshots | |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issue/CI integration with every write approval-gated | |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry and company research pack: chain map, policy timeline, company cards | |
| **[dsh-kit](https://github.com/PerryLink/dsh-kit)** | One-command starter pack that installs the core family | |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base with hybrid search and citation-aware injection | |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local Ollama model discovery and task-based routing with cloud fallback | |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions, symbols and rename | |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking at the model boundary with a host-side restore table | |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | MCP management console: `/mcp` command, Settings tab and trial calls | |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory protocol (`ctx.memory` + SQLite) | |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse telemetry export from the session event stream | |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Runtime-switchable model output styles | |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Declarative allow/deny/ask rules plus a process-level network policy | |
| **[dsh-plugin-certification](https://github.com/PerryLink/dsh-plugin-certification)** | Community certification registry with repro-checkable grades and badges | |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins | |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-dev knowledge base, agent skill and the `dsh-plugin-dev` CLI toolchain | |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins | |
| **[dsh-plugin-portal](https://github.com/PerryLink/dsh-plugin-portal)** | Zero-dependency static portal rendering the whole plugin family as one page | |
| **[dsh-plugin-upgrade-015](https://github.com/PerryLink/dsh-plugin-upgrade-015)** | Merged `0.1.3-alpha.1` → `0.1.5-rc.1` upgrade corridor card plus a zero-dependency seam scanner | |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat, Telegram, Feishu + a session console | |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research reports: evidence ledger, manifest seal, per-claim verdicts | |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional plugin quality scoring with an evidence-backed leaderboard | |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions and workspaces in the Web sidebar with per-pin colors | |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Git-backed cross-device session synchronization with keep-both merges | |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack plus the `plugin_vet` supply-chain gate | |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop: speech-to-text input and text-to-speech replies | |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives with a pass/fail matrix | |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel plus eleven agent tools | |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair | |
| **[dsh-wechat](https://github.com/pan17/dsh-wechat)** | WeChat ↔ DSH bridge (Tencent iLink bot) developed with [pan17](https://github.com/pan17/dsh-wechat), who hosts the repo | |
| **[dsh-personal-directive](https://github.com/PerryLink/dsh-personal-directive)** | Personal directive injector with a top-bar toggle (fork of liucai2026/dsh-personal-directive) | |
