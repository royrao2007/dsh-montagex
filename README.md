# MontageX

**A full-pipeline AI video production harness for DeepSeek Harness — from brief to final cut.**

MontageX 是一个 `dsh-plugin`，跑在 DeepSeek Harness（DSH）里：把一句话需求，经过分诊、排期、分镜、生成、拼装、质检，做成一条可交付的片子。它不实现第二套 agent loop——DSH 负责想、问、批、跑，MontageX 负责导演知识与媒体管线。

> 🇬🇧 **English overview:** MontageX is a full-pipeline AI video production harness for
> [DeepSeek Harness](https://www.deepseek.com/en/harness/). One request becomes a typed
> brief, a shot plan, a storyboard, generated media, an assembled timeline and a
> deterministic QC report. It registers **161 tools**: 153 production tools (brief
> triage, planning, storyboard, image/video/audio generation, infinite shot canvas,
> ffmpeg editing, grading, subtitles, QC) plus **8 team-collaboration tools**. It ships
> 359 knowledge articles, 196 skills and 15 recipes. Everything local (editing,
> grading, subtitle burn-in, QC) runs on ffmpeg and costs no model tokens; only
> confirmed generations spend money. Requires DSH `>=0.2.2-rc.1 <0.3.0-0` and
> Node.js ≥ 24.9.0.

---

## 🙏 致谢 / Acknowledgements

**MontageX 源自 [DirectorX](https://github.com/LaplaceYoung/dsh-directorx)，作者 LaplaceYoung。**

整条制作管线、知识库、技能与分镜画布，最初都来自他开源的 DirectorX；团队协作层是在其之上的新增。没有这份以 Apache-2.0 开放的作品，就没有这个项目。完整归属与授权分层见 [NOTICE](NOTICE)。

> **With thanks to [LaplaceYoung](https://github.com/LaplaceYoung)** — creator of
> [DirectorX](https://github.com/LaplaceYoung/dsh-directorx), the first
> DeepSeek Harness-native video production harness. MontageX's pipeline,
> knowledge corpus, skills and canvas began as that work. See [NOTICE](NOTICE).

---

## 它做什么

| 环节 | 能力 |
|---|---|
| 分诊 | `mont_brief` 判定类型、平台、时长、画幅，一次澄清，不写编号菜单 |
| 排期 | 按类型与时长推算镜头数，标出每镜的景别/运镜/布光与连续性锁 |
| 分镜 | 分镜格与累计时间轴，一格一镜，随时回答「现在到第几秒」 |
| 生成 | 图像 / 视频 / 音频，协议可换，无 Key 时走 mock 跑通全链 |
| 画布 | 无限分镜画布：镜头卡、连线、分组、按幕排布 |
| 剪辑 | 时间线、精剪、混音、字幕、调色，全部本地 ffmpeg |
| 质检 | 时长/画幅/黑场/响度/节奏的确定性检查，不靠模型「感觉过了」 |
| 团队 | 角色权限、镜头认领、批注、签核闸——见下 |

**161 个工具**，前缀 `mont_`；知识库 359 篇、技能 196 个、配方 15 个。

---

## 团队协作（本版新增）

一条片子通常不是一个人做完的：导演定意图、分镜师切镜、生成员跑贵的调用、另一个人签字。MontageX 把这层加在既有管线之上，不改动管线本身。

**五个角色**：`director` / `storyboarder` / `generator` / `reviewer` / `viewer`，权限逐级收窄。第一个成员无需授权；之后只有 `manage` 持有者能加人。

**三件事被真正管住**：

1. **认领**：一个镜头同时只能有一个人在手，避免两个人重复跑同一个贵镜头。
2. **批注**：批注挂在镜头 id 上而不是聊天记录里；`request` 类型的未解决批注会阻塞签核。
3. **签核闸**：`mont_team_approve_stage` 在该阶段覆盖的镜头上还有未解决修改要求时拒绝通过——这正是签核存在的意义。

看板是纯数据，落在 `<outputDir>/team/<productionId>.json`，团队共享一个目录（或一个 git 仓）就能看到同一块板。

```
mont_team_add_member     加成员并定角色
mont_team_assign         把镜头认领给某人
mont_team_complete       标记该镜完成，释放认领位
mont_team_note           在镜头上留批注（request / note / approval）
mont_team_resolve        解决批注
mont_team_approve_stage  签核阶段（有未解决 request 就拒绝）
mont_team_board          读看板：成员、认领、批注、签核、阻塞项
mont_team_whoami         查角色与权限矩阵
```

---

## 快速开始

**从 npm 安装**（推荐，最短）：

```bash
dsh plugin --profile web add dsh-montagex
dsh web
```

**在 WebUI 里装**：打开「插件 → 添加插件」，输入框只填 `dsh-montagex`（**不是**整行终端命令，也不要带 `dsh plugin --profile web add` 前缀）。

其它等价写法：

```bash
# 指定版本
dsh plugin --profile web add dsh-montagex@0.2.0

# 直接从 GitHub 装（npm 不可达时）
dsh plugin --profile web add github:royrao2007/dsh-montagex
```

> 输入框接受三种内容：npm 包名、`github:` 简写或完整 git 仓库地址、本地绝对目录。
> `royrao2007/dsh-montagex` 这种斜杠形式**不接受**；
> 一个 URL 里套两个 `https://` 这种双协议镜像前缀也**不接受**
> （会报 `a URL must point at a git repository or a tarball`）。
> 连不上默认主机时，改用 npm 包名安装。

打开 **Settings → MontageX**，四个能力各自开关：Vision / Image / Video / Audio。

### 安装时可能遇到的两个报错

**① `ERR_PNPM_IGNORED_BUILDS: canvas@2.11.2`**

`canvas` 是 `fabric`（经 `tui-image-editor` 引入）的可选原生依赖，Windows 上常编译失败。它**不影响 MontageX**，但 pnpm 11 默认把「未批准的构建脚本」当错误，导致安装被判定为失败。

在 profile 目录的 `pnpm-workspace.yaml` 里加一行即可：

```yaml
allowBuilds:
  canvas: false
```

profile 目录通常是：
- Windows：`%USERPROFILE%\.dsh\profiles\<profile>`
- 或 DSH 设置里指定的 DSH_HOME 下的 `profiles\<profile>`

**② `ERR_PNPM_EPERM: rename <pkg>_tmp_* -> <pkg>`**

pnpm 把包从临时目录改名成正式目录时被 Windows 拒绝。**原因是 DSH 正在运行**——它的进程持有 `node_modules` 里的目录句柄。

处理办法：**完全退出 DSH**（托盘图标右键退出，不是关窗口），再安装。若仍有残留，删掉 `node_modules` 下所有 `*_tmp_*` 目录后重试。

装完这两个问题都不影响使用：确认 `node_modules/dsh-montagex/lib/index.js` 存在即可。

没有 API Key 也能用：把四个能力切 `mock`，可以完整跑通 分诊 → 分镜 → 生成 → 拼装 → 质检，先把流程验通，再填 Key。

| 阶段 | 做什么 |
|---|---|
| 现在 | 四个能力切 `mock`，跑通全链 |
| 有 Key 之后 | 填 Base URL 与 Key，打开对应能力 |
| 新厂商 | 给 DSH 模型 id、文档、Key，走入驻流程；未知 HTTP 用 `generic-rest` |

关闭某个能力后，其对应工具会立刻从模型工具目录消失，不需要重启。

---

## 协议

四个能力共 13 种 mode：

| 能力 | mode |
|---|---|
| vision | `deepseek-chat` · `openai-chat` · `mock` |
| image | `openai-images` · `tasks` · `mock` |
| video | `openai-videos` · `tasks` · `kling` · `runway` · `mock` |
| audio | `openai-tts` · `mock` |

`generic-rest` 兜底：对不上任何现成 mode 的厂商，填一份封闭 AdapterSpec 即可接入，不用改代码。

---

## 要求

- **DeepSeek Harness `>=0.2.2-rc.1 <0.3.0-0`**（`package.json` 的 `engines.dsh`，即 0.2.2-rc.1 及以上、0.3 以下）
- **Node.js ≥ 24.9.0**
- 剪辑/质检需要本机 `ffmpeg`（缺失时工具会明确报错，不再静默失败）

---

## 许可

本项目包含两部分：

- 源自 **DirectorX** 的代码与内容 —— **Apache-2.0**，归属声明见 [NOTICE](NOTICE)，完整许可见 [LICENSE](LICENSE)
- MontageX 新增的团队协作模块（`src/team.ts`、`src/team-tools.ts`、`tests/team.test.mjs`）—— **MIT**，见 [LICENSE-MIT](LICENSE-MIT)

分发时请保留 `LICENSE`、`LICENSE-MIT` 与 `NOTICE` 三个文件。

---

## 开发

```bash
npm install
npm run typecheck
npm run build
npm test
```

`npm test` 会先跑 typecheck 与 build 再跑用例，保证提交产物与源码一致。

工具清单被冻结在 `tests/fixtures/tool-inventory.json`：任何无意的工具增删都会让测试失败；有意增删时需同时更新该快照。
