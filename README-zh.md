# dsh-data-quality

DeepSeek Harness 的确定性数据梳理、清洗与核查插件。

- **1024 商店渠道**：先 `npm i -g dsh1024`，再 `dsh1024 plugin --profile web add dsh-data-quality`（计入 [deepseek1024.com](https://deepseek1024.com) 安装排行）。

**DeepSeek Harness 的确定性数据梳理、清洗与核查插件。**

全部计算为 harness 进程内的纯 TypeScript —— 模型从不心算。`ctx.dataQuality` 能力缝隙（Service Definition / 本地 Provider / 工具 Consumer）对外提供三个模型工具，以及一份冻结的跨插件引用核查契约。

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

```sh
dsh plugin --profile <name> add dsh-data-quality
```

[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-data-quality.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-zh.svg)](https://dsh.market/)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-data-quality)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-data-quality?metric=downloads&lang=zh)](https://dshfind.com/zh/plugins/PerryLink/dsh-data-quality?ref=badge)


**📖 生态实测知识库**（实测数据，不是营销）：[插件开发指南 · 选型实测数据 · 维护取舍判据](https://perrylink.github.io/dsh-plugin-guide/)。

<!-- star-cta -->
## Install & uninstall

```sh
dsh plugin --profile web add dsh-data-quality      # 安装（npm）——或用上述其他形式
dsh plugin --profile web remove dsh-data-quality   # 卸载
```

## ⭐ 如果它帮到了你

这个插件是 [DSH 插件家族](https://github.com/PerryLink)的一员（95 个，全部 Apache-2.0）。如果你在用，**给个 star** —— 它不会解锁任何功能，但会让下一个人在搜索里更容易找到它。

*English:* part of a 95 plugin family for DeepSeek Harness. If it is useful, **a star helps the next person find it** — nothing is gated behind it.

## What is dsh-data-quality?

DeepSeek Harness 的确定性数据梳理、清洗与核查插件。

![dsh-data-quality 工作流图：问题 → 封存来源 → 报告。](docs/assets/dsh-data-quality-flow.svg)

*工作流概览：问题 → 封存来源 → 报告。下面的示例使用实际命令面。*


*同一次运行，动图版。*

## Comparison

![dsh-data-quality 的实测对比柱状图](https://raw.githubusercontent.com/PerryLink/dsh-data-quality/main/docs/assets/dsh-data-quality-evidence.png)

fixtures/dirty-fund-holdings.csv (10 rows x 6 columns) · 5 determinable dimensions · run locally

## Compatibility

| 组件 | 版本 |
|---|---|
| DeepSeek Harness | `dsh-v0.2.1-alpha.1`（2026-09-24 已适配）：peer 区间已接纳 alpha.2 线；该线上 `Session.append` 的第三参仅对表面事件类型存在且为 `SurfaceIntent`，因此审计门控仍为跳过、storage-domain 报告仍是持久副本。已于 2026-09-24 核验（双 typecheck 尺子 + 全量测试绿）。 |
| Node.js | `^22.19.0 \|\| >=24.0.0` |
| 包管理器 | `pnpm@11.7.0` |
| 平台 | Windows / macOS / Linux（纯宿主插件） |

## What you get

- **`ctx.dataQuality` 服务** —— 其他插件可选消费的 Cordis 服务（`inject = ['dataQuality']`）。除支撑四个工具的数据集操作外，还实现冻结的 `verifyCitations(request)` 契约：核查文档中引用的数字/字符串是否与数据集快照一致，数值按相对容差比较，状态为 `verified` / `mismatch` / `not-found` / `unverifiable`。
- **`data_profile` 工具** —— 数据集梳理：行/列数、推断列类型（number/date/boolean/string/empty/mixed）、缺失率、唯一值数、数值分布（min/max/mean/median/p25/p75）、IQR 离群计数、混合类型疑点提示、全表重复行计数。大文件可选确定性系统采样。
- **`data_clean` 工具** —— 有序声明式清洗规则：`dedupe`（按列组）、`fill-missing`（常量/均值/中位数/前向填充）、`coerce-type`（number/date/boolean，失败计数并置缺失）、`normalize-unit`（万/亿 等单位后缀归一）、`trim`、`map-values`（枚举映射）。返回逐规则审计日志与有界预览；仅在给出 `outputPath` 时落盘，且绝不覆盖源文件。
- **`data_verify` 工具** —— 声明式核查规则：`not-null`、`unique`、`range`、`regex`、`enum`、`cross-column`（如 `startDate < endDate`）、`freshness`（日期列距参考日期不超过 N 天）。逐规则 pass/fail 并附有界失败行证据；整体失败是正常结果 `passed: false`，不是工具错误。
- **持久化报告** —— 每次梳理/清洗/核查/引用检查都写入 `data_quality` storage domain（JSON 后端），键为运行时间戳加数据集路径指纹；工具结果以 `reportKey` 返回该键。清洗报告同时持久化有界预览，因此任何模型可见结果都能仅凭 `reportKey` 重建。
- **会话事件** —— 宿主支持时，运行会追加 `data-quality/profile` / `data-quality/clean` / `data-quality/verify` 事件（支持处带 `ignorable` 标记）。在已发布的 `0.1.7-rc.2` 线上（与更早的 rc 线一样）按设计跳过 append —— storage domain 报告始终是持久副本（见「Known limitations」）。

## Quick start

```sh
dsh plugin --profile web add github:PerryLink/dsh-data-quality
```

### npm 通道

```sh
dsh plugin --profile web add dsh-data-quality
```

### Tarball 通道（无需构建授权）

```sh
pnpm pack                                  # 产出 dsh-data-quality-<version>.tgz
dsh plugin --profile web add ./dsh-data-quality-<version>.tgz
```

### Git 通道

```sh
dsh plugin --profile web add github:YOUR_ORG/dsh-data-quality#<commit-sha>
```

第一次 `add` 会失败，因为 pnpm 默认阻止该包的 `prepare` 构建；把 pnpm 打印的键复制到 profile 的 `pnpm-workspace.yaml` 后重试：

```yaml
allowBuilds:
  'dsh-data-quality': true
```

安装后重启 profile 生效（bundle 重启激活）。然后在包含 CSV 的工作区中对 agent 说：

> 先梳理 `holdings.csv`，再按规则清洗：去空白、按 `fund_code` 去重、把 `holding_value` 列的 万/亿 单位归一；最后核查 `fund_code` 唯一且非空。

### 示例

以下为插件真实入口；安装后调用一个即可。

#### 详细示例

**命令**

~~~sh
data_profile({ path: "dirty-fund-holdings.csv" })
~~~

**输出**

~~~text
Profile of dirty-fund-holdings.csv: 10 rows x 6 columns
Duplicate rows: 1 (10.0%); sample row indexes: 8
- nav: mixed; missing 1 (10.0%); unique 7; note: mixed types among 9 present values: 8 numeric, 1 string
Scorecard (overall 93.2%, weighted 93.2%):
~~~

*来源 `README.md:147-149; test/profile.spec.ts:130-132; test/loader.spec.ts:98-99; src/profile.ts:311-315`*

#### 失败分支

**输入**

~~~text
{"path":"dirty-fund-holdings.csv","rules":[{"rule":"dedupe","columns":["nope"]}]}
~~~

**输出**

~~~text
isError=true; error.message=rule 0: unknown column "nope" (columns: fund_code, fund_name, nav, nav_date, holding_value, currency)
~~~

*来源 `plugins/dsh-data-quality/src/clean.ts:66-68; plugins/dsh-data-quality/fixtures/dirty-fund-holdings.csv; exercised through plugins/dsh-data-quality/test/harness.ts`*

#### 简短示例

- `data_clean`
- `data_verify`

## Configuration

所有键均可选（所示为默认值）；非法值在加载期响亮失败。每个键都可从 `cordis.yml` 修改（bundle 自带的 `cordis.patch.yml` 写有相同默认值）。

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | 总开关；`false` 时完全不挂载。 |
| `maxRows` | `200000` | 单次加载的硬行数上限；超限响亮拒绝（可用工具的 `sample` 参数）。 |
| `maxFileSizeMB` | `64` | 单次加载的硬文件大小上限（MiB）。 |
| `defaultTolerance` | `1e-9` | 引用未给 `tolerance` 时数值比较的默认相对容差。 |
| `evidenceRowLimit` | `20` | 单结果中失败行证据（核查）与预览行（清洗）的上限。 |
| `allowedExtensions` | `['.csv', '.tsv', '.json', '.jsonl']` | 可作为数据集的扩展名。 |
| `workspaceRoot` | `""` | 服务级调用（如 `verifyCitations`）无会话工作区时使用的绝对根；空 = harness 进程启动目录。工具调用始终使用会话工作区 cwd。 |
| `storeReports` | `true` | 把运行报告写入 `data_quality` storage domain 并返回 `reportKey`。 |
| `scorecardWeights` | 全为 1（等权） | 六维加权总分的各维度权重（completeness/uniqueness/validity/consistency/timeliness/accuracy）；每个权重必须是非负数。 |

## Tools & surfaces

### `data_profile({ path, sample?, industryPreset? })`

梳理工作区数据集。`path` 为工作区相对路径（`.csv`/`.tsv`/`.json`/`.jsonl`；JSON 必须是扁平对象数组）。`sample` 按每 `ceil(N/sample)` 行取样计算列卡片（确定性；行数仍精确）。`industryPreset`（`retail`/`saas`/`fund`/`real-estate`/`e-commerce`/`healthcare`/`logistics`/`manufacturing`/`energy`）注入该行业预期列，使计分卡 `accuracy` 维度可判定；未知 id 响亮失败。返回结构化报告，并渲染人类可读的逐列摘要。

### `data_clean({ path, rules, outputPath?, dryRun? })`

按数组顺序应用 `rules`，每条规则看到上一条的输出。规则参考：

| 规则 | 额外字段 | 语义 |
|---|---|---|
| `dedupe` | `columns?` | 删除键列组合与前行重复的行（保留首次；省略时为全部列）。 |
| `fill-missing` | `column`, `strategy`, `value?` | 填充缺失：`constant`（需 `value`）、`mean`/`median`（数值列）、`forward`（前一个非缺失值）。 |
| `coerce-type` | `column`, `to` | 转换为 `number`/`date`（ISO）/`boolean`；失败置缺失并计数入日志。 |
| `normalize-unit` | `column`, `factors` | 剥离单位后缀并乘系数（`{"万": 10000, "亿": 100000000}`）；纯数值也转换。 |
| `trim` | `columns?` | 去除字符串单元格首尾空白（省略时为全部列）。 |
| `map-values` | `column`, `map`, `else?` | 精确匹配映射；未映射值保留（`keep`，默认）或置缺失（`missing`）。 |

源文件**绝不**被覆盖。给出 `outputPath` 时清洗结果写入该路径（限定工作区内，按扩展名定格式）；否则仅预览。`dryRun: true` 时不写任何文件、不持久化任何内容——结果返回逐列清洗计划与预期的 `contract`/`diffPreview`。结果还携带交付前 `contract` 摘要，并持久化一份 `clean-diff` 前后对比画像报告。

### `data_report({ key?, kind?, format? })`

从存储域读回已持久化的报告。传 `key`（此前运行返回的精确 `reportKey`）取单份报告，或传 `kind`（`profile`/`clean`/`clean-diff`/`verify`/`citations`）按时间顺序列出该类全部报告；`key`/`kind` 恰需一个。格式错误或缺失的键响亮失败。`format: html`（需 `key`）把报告渲染为自包含离线 HTML 文档——内联 CSS/JS、无外部请求、DAMA 六维计分卡与画像/清洗汇总表（仅 profile/clean 报告）。

### `data_verify({ path, rules, expectations? })`

评估核查规则。规则参考：

| 规则 | 额外字段 | 语义 |
|---|---|---|
| `not-null` | `column` | 缺失（null/空/纯空白）即失败。 |
| `unique` | `columns` | 键组合重复的每一行都失败（缺失值参与判重）。 |
| `range` | `column`, `min?`, `max?` | 缺失/不可解析或超出闭区间即失败（至少需一个界）。 |
| `regex` | `column`, `pattern`, `flags?` | 缺失或不匹配即失败（完整 JS 正则）。 |
| `enum` | `column`, `values` | 去空白后的文本不在枚举内即失败。 |
| `cross-column` | `left`, `op`, `rightColumn?`, `value?` | 逐行比较：两侧可数值解析按数值，可日期解析按纪元毫秒，否则字符串仅支持 `==`/`!=`（`rightColumn`/`value` 恰给一个）。 |
| `freshness` | `column`, `maxAgeDays`, `asOf?` | 日期早于 `asOf` 前 `maxAgeDays` 天即失败（`asOf` 默认当前）；不可解析/缺失即失败。 |

任何被读取的单元格缺失都会使该规则该行失败。每条规则的失败行证据上限为 `evidenceRowLimit`。

`expectations` 用确定性指标对照期望值：`rowCount`、`columnSum`、`columnMean`、`uniqueCount`、`nullCount`（除 `rowCount` 外各带 `column`，加 `expected` 与可选相对 `tolerance`∈[0, 1]）。每项期望产出 `passed` 加 `actual`/`expected`/`tolerance`；不符是正常的 `passed: false` 判定，绝非工具错误。非法指标、缺失列、超范围 tolerance 响亮失败。

### `ctx.dataQuality`（供其他插件）

```ts
const result = await ctx.dataQuality.verifyCitations({
  dataset: 'holdings.csv',          // 相对 workspaceRoot 解析
  citations: [
    { id: 'c1', path: 'rows[3].nav', value: 1.234, tolerance: 0.01 },
    { id: 'c2', path: 'summary.annualReturn', value: '12.34%' },
  ],
})
// result.results[i] = { id, status: 'verified' | 'mismatch' | 'not-found' | 'unverifiable', actual?, note? }
```

定位符在数据集文档上行走：CSV/TSV 加载为 `{ columns, rows }`（故 `rows[3].nav` 可解析），JSON 为解析值本身，JSONL 为逐行解析值数组。数值按相对容差比较（`|a-b| <= tolerance * max(|a|, |b|)`）；可数值解析的 CSV 字符串单元格按数值比较；字符串精确比较；类型不可比为 `unverifiable`。服务另暴露 `profileDataset` / `cleanDataset` / `verifyDataset`（即四个工具调用的同一实现）。

## Permissions & data

- **读取**工作区数据集文件（仅白名单扩展名）。
- **写入**仅有：`data_clean` 的输出文件（显式 `outputPath`、限定工作区内、绝不覆盖输入）与 harness 数据目录下 `data_quality` storage domain 中的报告。
- **无网络、无凭据、无外部进程** —— 全部解析与统计都是进程内 TypeScript。
- 报告可能包含数据集的样本单元格值（受 `evidenceRowLimit` 与展示截断约束）；会话日志照常记录工具参数与结果。

## Security boundaries

- **路径限定** —— 数据集与输出路径必须解析在会话工作区内（`verifyCitations` 用 `workspaceRoot`）；拒绝 `..` 逃逸与根外绝对路径，比较前双侧归一化（Windows 斜杠安全）。
- **有界工作量** —— `maxRows` / `maxFileSizeMB` 守卫对超限输入响亮拒绝；abort 信号可中断长加载。
- **不覆盖** —— `data_clean` 拒绝与输入相同的 `outputPath`。
- **确定性计算** —— 相同输入相同输出；唯一的时钟是为 `freshness` 默认值与报告时间戳注入的时钟。

## Known limitations

- **会话事件是自适应的。** 已发布的 `0.1.7-rc.2` 线（与更早的 rc 线一样）没有插件会话事件注册面，`Session.append` 也无法打 `ignorable` 标记；追加未知 `data-quality/*` 类型会让会话日志在恢复时被拒读。因此插件仅在宿主认识该词汇或支持 `ignorable` append 时才追加；在已发布线上 storage domain 报告即持久记录。
- **CSV 方言** —— 逗号/制表符分隔、RFC-4180 引号、首行必须是表头、跳过空白行；无分隔符自动探测、无注释行。
- **类型解析是严格的** —— 数字不带千分位；日期为 `YYYY-MM-DD` / `YYYY/MM/DD` / ISO 风格时间（UTC）；布尔为 `true/false/yes/no/1/0`。其余一律按 `string`/`mixed` 梳理 —— 如有意图请用 `coerce-type` 清洗。
- **JSON 对工具必须是表格**（扁平对象数组）；`verifyCitations` 可行走任意 JSON 文档。
- **不做 ML 异常检测、不做 PII 脱敏、不连数据库、不做 SQL** —— 仅规则式疑点提示。

## Development

```sh
pnpm install
pnpm run typecheck && pnpm run typecheck:ci && pnpm run typecheck:checkout && pnpm test && pnpm run build
pnpm run verify:self-contained && pnpm run verify:artifacts && pnpm run verify:readme-sync && pnpm pack
```

- 测试用 vitest 跑 0.1.7-rc.2 peers 的真实 `Context`/`Session`/`ToolRuntime`/storage domain（不手写服务 mock）加纯引擎用例；每类清洗/核查规则都有正反用例，`verifyCitations` 覆盖四种状态。
- `scripts/loader-runner.mjs` 以真实 Loader 组合启动，并在无 API key 下对 `fixtures/` 执行 梳理 → 清洗 → 核查 链路。
- 发布：`node scripts/release.mjs <x.y.z>`（绝不 push；tag 触发 `release.yml`）。

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `data-quality` · `data-cleaning` · `data-profiling` · `data-verification`

## Contributors

感谢所有塑造本插件的贡献者。

- **PerryLink** — 维护与发布（`0.1.2`/`0.1.3`）、peer 依赖升级、npm 版本/下载量/CI 徽章，以及近期修复。
- **dsh-data-quality contributors** — 初始脚手架、`ctx.dataQuality` 能力缝与冻结的 `verifyCitations` 契约、确定性数据集层与纯引擎、`data_quality` storage-domain 报告、真实服务 vitest 套件、CI/compat/release 工作流，以及五语 README。

本仓库暂无公开 issue 或 pull request 历史；后续将在此逐个记名 PR/issue 编号。

## PerryLink DSH Plugin Family

本项目是 [PerryLink](https://github.com/PerryLink) 维护的 DeepSeek Harness 插件家族成员。完整名单默认折叠，避免每个 README 的首屏被长表淹没；点击展开可查看每一行及其状态。

<details>
<summary>展开全部插件</summary>

| 插件 | 状态 |
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
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | 🧊 已冻结 — 见仓库 README |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | 🧊 已冻结 — 见仓库 README |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | 🧊 已冻结 — 见仓库 README |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | 🧊 已冻结 — 见仓库 README |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | 🧊 已冻结 — 见仓库 README |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | 🚫 已退役 — 见仓库 README |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | 🚫 已退役 — 见仓库 README |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | 🚫 已退役 — 见仓库 README |

</details>
