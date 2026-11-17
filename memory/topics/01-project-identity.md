# 01 · 项目身份

来源：本会话实测 + 仓库文件读取（2026-11-17/18）

## 基本坐标

| 项 | 值 |
|---|---|
| GitHub | `royrao2007/dsh-montagex` |
| 包名 | `dsh-montagex` |
| 当前版本 | **0.2.2** |
| 插件 id / 设置命名空间 | `montagex` |
| 工具前缀 | `mont_` |
| 要求 DSH | `>=0.2.2-rc.1 <0.3.0-0` |
| 要求 Node | `>=24.9.0` |
| 本地源码 | `F:\DSHDesktop\chajian\montagex-kernel` |

## 许可分层（不可简化）

本仓库是**混合许可**，这是硬约束，不是选择：

- **Part 1 · Apache-2.0** —— 源自 DirectorX（作者 **LaplaceYoung**）的代码与内容。删掉归属或整体改 MIT 会违反 Apache-2.0 §4(a)(b)(c)。
- **Part 2 · MIT** —— 本项目自研的团队协作模块：`src/team.ts`、`src/team-tools.ts`、`tests/team.test.mjs`。

声明落在三处：`NOTICE`（含 ACKNOWLEDGEMENTS 致谢段）、`LICENSE`、`LICENSE-MIT`。
`package.json` 的 `license` 字段是 `SEE LICENSE IN NOTICE`——这是有意为之。

## 能力规模（0.2.2 实测）

| 类别 | 数量 |
|---|---|
| 工具总数 | **161**（153 制作 + 8 团队协作） |
| 知识库 | 358 篇 |
| 技能 | 56 个 |
| 配方 | 15 个 |
| 工作流 | 6 个 |

## 团队协作层（本版新增，MIT）

5 个角色：`director` / `storyboarder` / `generator` / `reviewer` / `viewer`，权限逐级收窄。
8 个工具：`mont_team_add_member` / `assign` / `complete` / `note` / `resolve` / `approve_stage` / `board` / `whoami`。

三个真正被管住的行为：
1. **认领**——一个镜头同时只能一人持有，避免重复跑贵镜头。
2. **批注**——挂在镜头 id 上而非聊天记录；未解决的 `request` 类批注会阻塞签核。
3. **签核闸**——`mont_team_approve_stage` 在该阶段覆盖的镜头上仍有未解决要求时拒绝通过。

看板是纯数据，落在 `<outputDir>/team/<productionId>.json`，共享目录即可共享看板。
