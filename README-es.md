# dsh-data-quality

Perfilado, limpieza y verificación de datos deterministas para DeepSeek Harness.

- **Canal 1024 store**: `npm i -g dsh1024` una vez, luego `dsh1024 plugin --profile web add dsh-data-quality` (cuenta para el ranking de instalaciones de [deepseek1024.com](https://deepseek1024.com)).

**Perfilado, limpieza y verificación de datos deterministas para DeepSeek Harness.**

Todo el cálculo es TypeScript puro dentro del proceso del harness — el modelo nunca hace las cuentas. Una costura de capacidad `ctx.dataQuality` (Service Definition / Provider local / Consumers de herramientas) expone tres herramientas para el modelo más un contrato congelado de verificación de citas entre plugins.

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

```sh
dsh plugin --profile <name> add dsh-data-quality
```

[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-data-quality.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-en.svg)](https://dsh.market/)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-data-quality)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-data-quality?metric=downloads&lang=es)](https://dshfind.com/es/plugins/PerryLink/dsh-data-quality?ref=badge)


**📖 Base de conocimiento del ecosistema** — datos medidos, no marketing: [guía de desarrollo · datos de selección · criterios de mantenimiento](https://perrylink.github.io/dsh-plugin-guide/).

<!-- star-cta -->
## Install & uninstall

```sh
dsh plugin --profile web add dsh-data-quality      # instalar (npm) — o las formas anteriores
dsh plugin --profile web remove dsh-data-quality   # desinstalar
```

## ⭐ 如果它帮到了你

Este plugin forma parte de la [familia de plugins DSH](https://github.com/PerryLink) (más de 40, todos Apache-2.0). Si te resulta útil, **dale una estrella**: no desbloquea nada, pero ayuda a que la siguiente persona lo encuentre antes.

*English:* part of a 95 plugin family for DeepSeek Harness. If it is useful, **a star helps the next person find it** — nothing is gated behind it.

## What is dsh-data-quality?

Perfilado, limpieza y verificación de datos deterministas para DeepSeek Harness.

![Demostración de terminal de dsh-data-quality: dsh-data-quality — data_profile over the repo's own dirty fixture](https://raw.githubusercontent.com/PerryLink/dsh-data-quality/main/docs/assets/dsh-data-quality-hero.png)

![Animated terminal demo of dsh-data-quality](https://raw.githubusercontent.com/PerryLink/dsh-data-quality/main/docs/assets/dsh-data-quality-demo.gif)

*La misma ejecución, animada.*

## Comparison

![Gráfico comparativo medido de dsh-data-quality](https://raw.githubusercontent.com/PerryLink/dsh-data-quality/main/docs/assets/dsh-data-quality-evidence.png)

fixtures/dirty-fund-holdings.csv (10 rows x 6 columns) · 5 determinable dimensions · run locally

## Compatibility

| Componente | Versión |
|---|---|
| DeepSeek Harness | `dsh-v0.2.1-alpha.1` (adaptado el 2026-10-04): el rango de peers admite la línea alpha.2; allí el tercer parámetro de `Session.append` existe solo para tipos de superficie y es un `SurfaceIntent`, así que la puerta de auditoría sigue omitiendo y el informe del dominio de almacenamiento sigue siendo la copia duradera. Verificado el 2026-09-24 (doble typecheck + suite completa en verde). |
| Node.js | `^22.19.0 \|\| >=24.0.0` |
| Gestor de paquetes | `pnpm@11.7.0` |
| Plataforma | Windows / macOS / Linux (plugin solo de host) |

## What you get

- **Servicio `ctx.dataQuality`** — un servicio Cordis que otros plugins pueden consumir opcionalmente (`inject = ['dataQuality']`). Además de las tres operaciones sobre datasets detrás de las herramientas, implementa el contrato congelado `verifyCitations(request)`: verifica que los números/cadenas citados en un documento coincidan con una instantánea del dataset, con comparación numérica por tolerancia relativa y estados `verified` / `mismatch` / `not-found` / `unverifiable`.
- **Herramienta `data_profile`** — perfilado de datasets: conteos de filas/columnas, tipos de columna inferidos (number/date/boolean/string/empty/mixed), tasas de valores faltantes, conteos de valores únicos, distribuciones numéricas (min/max/mean/median/p25/p75), conteo de valores atípicos IQR, notas de sospecha por tipos mixtos y conteo de filas duplicadas de la tabla completa. Muestreo sistemático determinista opcional para archivos grandes.
- **Herramienta `data_clean`** — reglas declarativas de limpieza en orden: `dedupe` (por grupo de columnas), `fill-missing` (constant/mean/median/forward), `coerce-type` (number/date/boolean; los fallos se cuentan y quedan como faltantes), `normalize-unit` (p. ej. sufijos 万/亿 a unidades base), `trim`, `map-values` (mapeo de enumeraciones). Devuelve un registro de auditoría por regla más una vista previa acotada; solo escribe el dataset limpio cuando se indica `outputPath` y nunca sobrescribe el origen.
- **Herramienta `data_verify`** — reglas declarativas de verificación: `not-null`, `unique`, `range`, `regex`, `enum`, `cross-column` (p. ej. `startDate < endDate`), `freshness` (columna de fecha dentro de N días de una fecha de referencia). pass/fail por regla con evidencia acotada de filas fallidas; un fallo global es un resultado normal `passed: false`, no un error de herramienta.
- **Informes duraderos** — cada ejecución de perfilado/limpieza/verificación/citas persiste en el dominio de almacenamiento `data_quality` (backend JSON), con clave de marca de tiempo más huella de la ruta del dataset; la clave se devuelve como `reportKey` en los resultados. Los informes de limpieza también persisten la vista previa acotada, de modo que todo resultado visible para el modelo es reconstruible a partir de su `reportKey`.
- **Eventos de sesión** — en hosts que los soportan con seguridad, las ejecuciones añaden eventos `data-quality/profile` / `data-quality/clean` / `data-quality/verify` (con la marca `ignorable` donde se admite). En la línea publicada `0.1.7-rc.2` (como en las líneas rc anteriores) el append se omite por diseño — el informe del dominio de almacenamiento es siempre la copia duradera (véase «Known limitations»).

## Quick start

```sh
dsh plugin --profile web add github:PerryLink/dsh-data-quality
```

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

- **Los eventos de sesión son adaptativos.** La línea publicada `0.1.7-rc.2` (como las líneas rc anteriores) no tiene superficie de registro de eventos de sesión para plugins y su `Session.append` no puede estampar la marca `ignorable`, así que añadir un tipo `data-quality/*` desconocido haría ilegible el registro de sesión al restaurarlo. Por eso el plugin solo añade cuando el host conoce el vocabulario o soporta el flag `ignorable`; en la línea publicada el informe del dominio de almacenamiento es el registro duradero.
- **Dialecto CSV** — coma/tab con comillas RFC-4180, fila de cabecera obligatoria, líneas en blanco omitidas; sin autodetección de delimitador ni líneas de comentario.
- **El parseo de tipos es estricto** — los números no llevan separadores de miles; las fechas son `YYYY-MM-DD` / `YYYY/MM/DD` / datetimes estilo ISO (UTC); los booleanos son `true/false/yes/no/1/0`. Todo lo demás se perfila como `string`/`mixed` — límpialo con `coerce-type` si es intencionado.
- **JSON debe ser tabular para las herramientas** (array de objetos planos); `verifyCitations` recorre documentos JSON arbitrarios.
- **Sin detección de anomalías por ML, sin enmascarado de PII, sin bases de datos, sin SQL** — solo notas de sospecha basadas en reglas.

## Development

```sh
pnpm install
pnpm run typecheck && pnpm run typecheck:ci && pnpm run typecheck:checkout && pnpm test && pnpm run build
pnpm run verify:self-contained && pnpm run verify:artifacts && pnpm run verify:readme-sync && pnpm pack
```

- Las pruebas ejecutan vitest contra los `Context`/`Session`/`ToolRuntime`/dominio de almacenamiento REALES de los peers 0.1.7-rc.2 (sin mocks de servicios escritos a mano) más specs de motor puros; cada regla de limpieza/verificación tiene casos positivos y negativos, y `verifyCitations` cubre los cuatro estados.
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

Este proyecto forma parte de la familia de plugins de DeepSeek Harness de [PerryLink](https://github.com/PerryLink). El registro permanece plegado abajo para que cada README conserve una primera pantalla corta; expándelo para ver cada fila y su estado.

<details>
<summary>Expandir todos los plugins</summary>

| Plugin | Estado |
|---|---|
| **[dsh-aqua-input-check](https://github.com/PerryLink/dsh-aqua-input-check)** |  |
| **[dsh-archive-check](https://github.com/PerryLink/dsh-archive-check)** |  |
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** |  |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** |  |
| **[dsh-bid-ca-precheck](https://github.com/PerryLink/dsh-bid-ca-precheck)** |  |
| **[dsh-bid-qual-check](https://github.com/PerryLink/dsh-bid-qual-check)** |  |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** |  |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** |  |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** |  |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** |  |
| **[dsh-contract-stance](https://github.com/PerryLink/dsh-contract-stance)** |  |
| **[dsh-customs-doc-check](https://github.com/PerryLink/dsh-customs-doc-check)** |  |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** |  |
| **[dsh-demurrage-ledger](https://github.com/PerryLink/dsh-demurrage-ledger)** |  |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** |  |
| **[dsh-drill-script-check](https://github.com/PerryLink/dsh-drill-script-check)** |  |
| **[dsh-eia-guide-check](https://github.com/PerryLink/dsh-eia-guide-check)** |  |
| **[dsh-emergency-plan](https://github.com/PerryLink/dsh-emergency-plan)** |  |
| **[dsh-essay-rubric-check](https://github.com/PerryLink/dsh-essay-rubric-check)** |  |
| **[dsh-evidence-check](https://github.com/PerryLink/dsh-evidence-check)** |  |
| **[dsh-export-ctl-check](https://github.com/PerryLink/dsh-export-ctl-check)** |  |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** |  |
| **[dsh-fmea-table-check](https://github.com/PerryLink/dsh-fmea-table-check)** |  |
| **[dsh-forecast-penalty](https://github.com/PerryLink/dsh-forecast-penalty)** |  |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** |  |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** |  |
| **[dsh-gongwen-flow-check](https://github.com/PerryLink/dsh-gongwen-flow-check)** |  |
| **[dsh-gongwen-word-check](https://github.com/PerryLink/dsh-gongwen-word-check)** |  |
| **[dsh-guard-plan-qc](https://github.com/PerryLink/dsh-guard-plan-qc)** |  |
| **[dsh-hazchem-check](https://github.com/PerryLink/dsh-hazchem-check)** |  |
| **[dsh-hazplan-check](https://github.com/PerryLink/dsh-hazplan-check)** |  |
| **[dsh-hidden-risk-map](https://github.com/PerryLink/dsh-hidden-risk-map)** |  |
| **[dsh-hs-classify](https://github.com/PerryLink/dsh-hs-classify)** |  |
| **[dsh-icd-rule-check](https://github.com/PerryLink/dsh-icd-rule-check)** |  |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** |  |
| **[dsh-lawcite-adapter](https://github.com/PerryLink/dsh-lawcite-adapter)** |  |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** |  |
| **[dsh-lc-doc-check](https://github.com/PerryLink/dsh-lc-doc-check)** |  |
| **[dsh-learning-gap-check](https://github.com/PerryLink/dsh-learning-gap-check)** |  |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** |  |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** |  |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** |  |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** |  |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** |  |
| **[dsh-medrec-qc](https://github.com/PerryLink/dsh-medrec-qc)** |  |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** |  |
| **[dsh-nsfc-form-check](https://github.com/PerryLink/dsh-nsfc-form-check)** |  |
| **[dsh-nurse-record-check](https://github.com/PerryLink/dsh-nurse-record-check)** |  |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** |  |
| **[dsh-origin-rvc-check](https://github.com/PerryLink/dsh-origin-rvc-check)** |  |
| **[dsh-ota-review-check](https://github.com/PerryLink/dsh-ota-review-check)** |  |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** |  |
| **[dsh-paper-doc-adapter](https://github.com/PerryLink/dsh-paper-doc-adapter)** |  |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** |  |
| **[dsh-permit-report-check](https://github.com/PerryLink/dsh-permit-report-check)** |  |
| **[dsh-pipeline-check](https://github.com/PerryLink/dsh-pipeline-check)** |  |
| **[dsh-pleading-draft](https://github.com/PerryLink/dsh-pleading-draft)** |  |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** |  |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** |  |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** |  |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** |  |
| **[dsh-policy-brief-draft](https://github.com/PerryLink/dsh-policy-brief-draft)** |  |
| **[dsh-power-loss-split](https://github.com/PerryLink/dsh-power-loss-split)** |  |
| **[dsh-power-ticket-check](https://github.com/PerryLink/dsh-power-ticket-check)** |  |
| **[dsh-ppap-check](https://github.com/PerryLink/dsh-ppap-check)** |  |
| **[dsh-protest-deadline](https://github.com/PerryLink/dsh-protest-deadline)** |  |
| **[dsh-railway-window](https://github.com/PerryLink/dsh-railway-window)** |  |
| **[dsh-repair-order-qc](https://github.com/PerryLink/dsh-repair-order-qc)** |  |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** |  |
| **[dsh-review-reply-check](https://github.com/PerryLink/dsh-review-reply-check)** |  |
| **[dsh-rulefile-check](https://github.com/PerryLink/dsh-rulefile-check)** |  |
| **[dsh-safety-brief-check](https://github.com/PerryLink/dsh-safety-brief-check)** |  |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** |  |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** |  |
| **[dsh-site-log-check](https://github.com/PerryLink/dsh-site-log-check)** |  |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** |  |
| **[dsh-soe-decision-check](https://github.com/PerryLink/dsh-soe-decision-check)** |  |
| **[dsh-soilwater-check](https://github.com/PerryLink/dsh-soilwater-check)** |  |
| **[dsh-sop-sync-check](https://github.com/PerryLink/dsh-sop-sync-check)** |  |
| **[dsh-spc-gbt-adapter](https://github.com/PerryLink/dsh-spc-gbt-adapter)** |  |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** |  |
| **[dsh-tender-extract](https://github.com/PerryLink/dsh-tender-extract)** |  |
| **[dsh-tender-matrix](https://github.com/PerryLink/dsh-tender-matrix)** |  |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** |  |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** |  |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** |  |
| **[dsh-warranty-calc](https://github.com/PerryLink/dsh-warranty-calc)** |  |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | 🧊 CONGELADO — ver el README del repositorio |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | 🧊 CONGELADO — ver el README del repositorio |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | 🧊 CONGELADO — ver el README del repositorio |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | 🧊 CONGELADO — ver el README del repositorio |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | 🧊 CONGELADO — ver el README del repositorio |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | 🚫 RETIRADO — ver el README del repositorio |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | 🚫 RETIRADO — ver el README del repositorio |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | 🚫 RETIRADO — ver el README del repositorio |

</details>