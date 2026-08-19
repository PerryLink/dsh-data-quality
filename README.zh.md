# dsh-data-quality

**DeepSeek Harness 的确定性数据梳理、清洗与核查插件。**

全部计算为 harness 进程内的纯 TypeScript —— 模型从不心算。`ctx.dataQuality` 能力缝隙（Service Definition / 本地 Provider / 工具 Consumer）对外提供三个模型工具，以及一份冻结的跨插件引用核查契约。

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

## Compatibility

| 组件 | 版本 |
|---|---|
| DeepSeek Harness | `0.1.0-rc.6`（peer 依赖钉版） |
| Node.js | `^22.19.0 \|\| >=24.0.0` |
| 包管理器 | `pnpm@11.7.0` |
| 平台 | Windows / macOS / Linux（纯宿主插件） |

## What you get

- **`ctx.dataQuality` 服务** —— 其他插件可选消费的 Cordis 服务（`inject = ['dataQuality']`）。除支撑三个工具的数据集操作外，还实现冻结的 `verifyCitations(request)` 契约：核查文档中引用的数字/字符串是否与数据集快照一致，数值按相对容差比较，状态为 `verified` / `mismatch` / `not-found` / `unverifiable`。
- **`data_profile` 工具** —— 数据集梳理：行/列数、推断列类型（number/date/boolean/string/empty/mixed）、缺失率、唯一值数、数值分布（min/max/mean/median/p25/p75）、IQR 离群计数、混合类型疑点提示、全表重复行计数。大文件可选确定性系统采样。
- **`data_clean` 工具** —— 有序声明式清洗规则：`dedupe`（按列组）、`fill-missing`（常量/均值/中位数/前向填充）、`coerce-type`（number/date/boolean，失败计数并置缺失）、`normalize-unit`（万/亿 等单位后缀归一）、`trim`、`map-values`（枚举映射）。返回逐规则审计日志与有界预览；仅在给出 `outputPath` 时落盘，且绝不覆盖源文件。
- **`data_verify` 工具** —— 声明式核查规则：`not-null`、`unique`、`range`、`regex`、`enum`、`cross-column`（如 `startDate < endDate`）、`freshness`（日期列距参考日期不超过 N 天）。逐规则 pass/fail 并附有界失败行证据；整体失败是正常结果 `passed: false`，不是工具错误。
- **持久化报告** —— 每次梳理/清洗/核查/引用检查都写入 `data_quality` storage domain（JSON 后端），键为运行时间戳加数据集路径指纹；工具结果以 `reportKey` 返回该键。
- **会话事件** —— 宿主支持时，运行会追加 `data-quality/profile` / `data-quality/clean` / `data-quality/verify` 事件（支持处带 `ignorable` 标记）。在 0.1.0-rc.6 上按设计跳过 append —— storage domain 报告始终是持久副本（见「Known limitations」）。

## Quick start

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

## Install & uninstall

```sh
dsh plugin --profile web add dsh-data-quality      # 安装（npm）——或用上述其他形式
dsh plugin --profile web remove dsh-data-quality   # 卸载
```

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

## Tools & surfaces

### `data_profile({ path, sample? })`

梳理工作区数据集。`path` 为工作区相对路径（`.csv`/`.tsv`/`.json`/`.jsonl`；JSON 必须是扁平对象数组）。`sample` 按每 `ceil(N/sample)` 行取样计算列卡片（确定性；行数仍精确）。返回结构化报告，并渲染人类可读的逐列摘要。

### `data_clean({ path, rules, outputPath? })`

按数组顺序应用 `rules`，每条规则看到上一条的输出。规则参考：

| 规则 | 额外字段 | 语义 |
|---|---|---|
| `dedupe` | `columns?` | 删除键列组合与前行重复的行（保留首次；省略时为全部列）。 |
| `fill-missing` | `column`, `strategy`, `value?` | 填充缺失：`constant`（需 `value`）、`mean`/`median`（数值列）、`forward`（前一个非缺失值）。 |
| `coerce-type` | `column`, `to` | 转换为 `number`/`date`（ISO）/`boolean`；失败置缺失并计数入日志。 |
| `normalize-unit` | `column`, `factors` | 剥离单位后缀并乘系数（`{"万": 10000, "亿": 100000000}`）；纯数值也转换。 |
| `trim` | `columns?` | 去除字符串单元格首尾空白（省略时为全部列）。 |
| `map-values` | `column`, `map`, `else?` | 精确匹配映射；未映射值保留（`keep`，默认）或置缺失（`missing`）。 |

源文件**绝不**被覆盖。给出 `outputPath` 时清洗结果写入该路径（限定工作区内，按扩展名定格式）；否则仅预览。

### `data_verify({ path, rules })`

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

定位符在数据集文档上行走：CSV/TSV 加载为 `{ columns, rows }`（故 `rows[3].nav` 可解析），JSON 为解析值本身，JSONL 为逐行解析值数组。数值按相对容差比较（`|a-b| <= tolerance * max(|a|, |b|)`）；可数值解析的 CSV 字符串单元格按数值比较；字符串精确比较；类型不可比为 `unverifiable`。服务另暴露 `profileDataset` / `cleanDataset` / `verifyDataset`（即三个工具调用的同一实现）。

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

- **会话事件是自适应的。** 0.1.0-rc.6 没有插件会话事件注册面，`Session.append` 也无法打 `ignorable` 标记；追加未知 `data-quality/*` 类型会让会话日志在恢复时被拒读。因此插件仅在宿主认识该词汇或支持 `ignorable` append 时才追加；在 rc.6 上 storage domain 报告即持久记录。
- **CSV 方言** —— 逗号/制表符分隔、RFC-4180 引号、首行必须是表头、跳过空白行；无分隔符自动探测、无注释行。
- **类型解析是严格的** —— 数字不带千分位；日期为 `YYYY-MM-DD` / `YYYY/MM/DD` / ISO 风格时间（UTC）；布尔为 `true/false/yes/no/1/0`。其余一律按 `string`/`mixed` 梳理 —— 如有意图请用 `coerce-type` 清洗。
- **JSON 对工具必须是表格**（扁平对象数组）；`verifyCitations` 可行走任意 JSON 文档。
- **不做 ML 异常检测、不做 PII 脱敏、不连数据库、不做 SQL** —— 仅规则式疑点提示。

## Development

```sh
pnpm install
pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build
pnpm run verify:self-contained && pnpm run verify:artifacts && pnpm run verify:readme-sync && pnpm pack
```

- 测试用 vitest 跑 0.1.0-rc.6 peers 的真实 `Context`/`Session`/`ToolRuntime`/storage domain（不手写服务 mock）加纯引擎用例；每类清洗/核查规则都有正反用例，`verifyCitations` 覆盖四种状态。
- `scripts/loader-runner.mjs` 以真实 Loader 组合启动，并在无 API key 下对 `fixtures/` 执行 梳理 → 清洗 → 核查 链路。
- 发布：`node scripts/release.mjs <x.y.z>`（绝不 push；tag 触发 `release.yml`）。

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `data-quality` · `data-cleaning` · `data-profiling` · `data-verification`

## Contributors

由 dsh-data-quality contributors 维护。仓库公开后欢迎 issue 与 pull request。

## PerryLink DSH Plugin Family

本插件遵循 DSH 家族共享工程规范：bundle 清单打包（`dsh.bundle` + `cordis.patch.yml`）、同步门禁约束的五语 README、响亮失败的 Schemastery 配置、真实服务 vitest 覆盖、CI/compat/release 三工作流链。

## License

Apache-2.0 —— 见 [LICENSE](LICENSE) 与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
