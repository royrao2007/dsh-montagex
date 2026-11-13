# 本地修改说明 / Local Modifications Notice

> **本仓库不是原作者的分支声明，也不代表原作者。**
> 上游项目与版权归 **LaplaceYoung** 所有：
> - 上游仓库：https://github.com/LaplaceYoung/dsh-montagex
> - 上游版本：`v0.2.0`（commit `5264d2a78e631702abcf2382d8cf566e8a09f6ec`）
> - 许可证：**Apache-2.0**（见 `LICENSE`，未作任何修改）
>
> 本副本由使用者在本地为「让插件在 **DeepSeek Harness 0.2.2-rc.2** 上真正可用」而修改，
> 依 Apache-2.0 第 4(b) 条，此处明确声明**修改了哪些文件、改了什么**。
> 上游的 README / 知识库 / 技能 / 配方内容**一律未改**。

---

## 1. 为什么需要改

上游 `v0.2.0` 是按 **DSH 0.1.x** 的插件 API 写的。0.2.x 移除了三个它依赖的接缝，
所以原样装上去会**激活即失败**（`TypeError: ctx.settings.register is not a function`），
153 个工具一个都注册不上。

| 被移除的接缝 | 影响面 |
|---|---|
| `ctx.settings.register(ns, Schema, opts)` → `scope.get/update/watch` | Host 半边，`apply()` 第一段就炸 |
| 浏览器 `settingsScope` 服务 | Client 半边，web boot 报「entry did not activate」 |
| `settings.plugin.item` 槽位 | Client 半边，设置页挂不上 |

之前仓库里那份 `patches/0.2-compat.mjs` 是给**构建产物**打运行时垫片：它伪造了一个
`scope` 对象，绕过了缺失的 API，但代价是**设置页彻底没有**（只能改 patch 里的
`config:`），而且 `lib/` 与 `src/` 不同步。本副本改为**在源码层面正确迁移**，
垫片已不再使用。

## 2. 改了什么（按 DSH 0.2.2 的真实契约）

### Host 半边

| 文件 | 改动 |
|---|---|
| `src/config.ts` | 四个能力对象与 `persona`/`initiative` 标量加 `.volatile()`（带 3.19 缺失时的降级探测）。这是设置页可读写、且保存后**不重启插件**的前提 |
| `src/index.ts` | 删除 `ctx.settings.register`；改为导出 `Config` 并 `apply(ctx, config)`；四个 configurable provider 保留；所有路由取值改为读活快照 |
| `src/settings-bridge.ts` | **新增**。volatile 引用 → 普通快照的适配层；`settings/document-updated` 监听；`configEditor.edit()` 写回 profile 行 |
| `src/dsh.d.ts` | 按 0.2.2 重写结构类型（`fiber.entry`、`configEditor`、`settings.describe/mutate`），并记下已移除的旧名 |

### Client 半边

| 文件 | 改动 |
|---|---|
| `src/client/index.ts` | `inject` 去掉 `settingsScope`、加 `configForms`；设置页只注册 `settings.section`（`id: 'montagex'`）；删除 `settings.plugin.item` 与旧 `adaptSettings` 分路 |
| `src/client/MontagexSettingsSection.tsx` | 数据源从 `settingsScope` 换成 `ctx.configForms.get('montagex')`；写入走 `form.mutate(ops, revision)`；删除已死的 `describe` 轮询与 legacy 分支 |

### 清单与文档

| 文件 | 改动 |
|---|---|
| `package.json` | `engines.dsh: ">=0.2.2-rc.1"`、`engines.node: ">=24.9.0"`；peer 依赖从通配 `*` 收紧到真实下限 |
| `tests/*.test.mjs` | 两处断言固化了已移除的 0.1.x 接缝（`settingsScope`、`settings.plugin.item`），改为断言 0.2.x 的替代面 |
| `docs/architecture.md` | 服务表、设置与热重载、0.2.x 迁移对照表 |

## 3. 行为等价性

工具数量、名称、schema、默认值、返回语义**均未变**：仍是 **153 个 `mont_*` 工具**，
四个能力的默认 mode / baseURL / model 一字未动，`generic-rest` 适配层、OKF 语料、
技能、配方全部原样保留。改的只是「设置从哪来、往哪写」。

## 4. 验证结果（本机实测，2026-11-12）

| 项 | 结果 |
|---|---|
| `npm run typecheck` | 0 error（分别对 schemastery 3.19 与 3.18 类型各验一次） |
| `npm test` | 357 用例：**314 pass / 2 fail / 41 skip**；2 个 fail 是 `dev-loop` 的 Windows CRLF 断言，**改前改后完全一致**（非本次引入） |
| Host 激活（真实组合 profile） | **153 个 `mont_*` 工具在 live tool registry 中可见** |
| 活配置生效 | volatile 写入 + `settings/document-updated` 后，关掉 image 只移除 `mont_generate_image`，video 不受影响；无关命名空间的事件不触发重注册 |
| Client 装配 | `settings.section` 以 `id: montagex` 注册、拿到 `configForms` 表单、首帧为 loading、无表单时如实说明 |
| 降级路径 | 插件自带 schemastery 3.18（无 `.volatile()`）时仍能激活并注册 153 个工具，只是失去热重载与设置页 |

## 5. 已知未做 / 剩余项

| 项 | 说明 |
|---|---|
| 装进 **desktop** profile | 未安装。本机 desktop profile 正被运行中的 DSH 实例持有，`pnpm` 写入被 **EPERM** 拒绝；为不破坏这份在用 profile，只在闲置的 `headless` profile 里做了完整安装 → 组合 → 激活验证，验证后已卸载复原 |
| 设置页视觉 | 需要在 Web GUI 里人工确认渲染效果；本次只做到装配与状态机层面的验证 |
| `montagex-recipes` 技能名缺失 | 上游既有问题，插件自身有降级，未改 |

## 6. 如何安装

从 GitHub 安装（线上方式，任何机器都能用）：

```bash
dsh plugin --profile web add github:royrao2007/dsh-montagex
dsh web
```

在 WebUI 里装：**插件 → 添加插件**，输入框填 `github:royrao2007/dsh-montagex`
（该框只接受 npm 包名、`github:` 简写或仓库地址、本地目录三种内容，
不要填整行终端命令）。

> `dsh-montagex` 尚未发布到 npm，因此只填裸包名 `dsh-montagex` 会报
> `not a package name the registry accepts`。用上面两种之一。
>
> 网络连不上 GitHub 时，可换成镜像前缀，例如
> `https://gh-proxy.com/https://github.com/royrao2007/dsh-montagex`。

装好后在 **Settings → MontageX** 配四个能力；关闭某个能力后其对应工具会立刻从
模型工具目录消失，不需要重启。

## 7. 许可与归属

- 原始代码与文档：**© LaplaceYoung**，Apache-2.0。
- 本副本的改动部分同样是 Apache-2.0；分发时请保留 `LICENSE` 与本说明。
- 若上游发布了支持 DSH 0.2.2 的正式版本，建议直接切换到上游版本。
