# 03 · 安装机制与两种必遇报错

来源：本机实测（Windows + DSH Desktop 0.2.2-rc.2）

## 命令行的硬限制

```bash
dsh plugin --profile desktop add <任何包>
# → error: profile "desktop" is managed exclusively by the Electron application
```

**desktop profile 由 Electron 应用独占管理，CLI 一律拒绝。**

所以 desktop profile 的插件只能：
1. 在 GUI 里装，或
2. 完全退出 DSH 后用 `pnpm add` 直装，再手工登记 bundle。

headless / web 等 profile 不受此限。

## 报错一：ERR_PNPM_IGNORED_BUILDS（所有用户都会遇到）

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: canvas@2.11.2
```

**成因链**：`dsh-montagex` → `tui-image-editor` → `fabric` → `canvas`。
`canvas` 在 `fabric` 里同时出现在 `dependencies` 和 `optionalDependencies`（可选原生依赖），
Windows 上常编译失败。pnpm 11 把「未批准的构建脚本」当成错误，整个安装被判定失败。

**它不影响 MontageX**，但会让安装看起来失败。

**修复**——在 profile 的 `pnpm-workspace.yaml` 加一行：

```yaml
allowBuilds:
  canvas: false
```

实测效果：干净 profile 上从「失败」变成 **2.7 秒装完**，deps 与 bundles 自动登记，161 工具全激活。

## 报错二：ERR_PNPM_EPERM（本机环境特有）

```
[ERR_PNPM_EPERM] rename '<pkg>_tmp_<pid>_<n>' -> '<pkg>'
```

**成因**：pnpm 把包从临时目录改名成正式目录时被 Windows 拒绝。DSH 运行时其进程持有
`node_modules` 里的目录句柄，导致 rename 失败。

现场证据：目录内**文件可读写可删**，只有**目录本身不能重命名**——这是目录句柄被占的典型特征。

**修复**：完全退出 DSH（托盘右键退出，不是关窗口），再安装。
若仍有 `*_tmp_*` 残留，删掉它们后重试。

## 判断安装是否真的成功

不要看错误提示，看这三件事：

```
node_modules/dsh-montagex/lib/index.js   存在
package.json → dependencies 含 dsh-montagex
package.json → dsh.profile.bundles 含 dsh-montagex
```

包体完整约 751 文件 / 17.9 MB。

## 本机路径速查

| 用途 | 路径 |
|---|---|
| DSH 安装目录 | `D:\Program files\deepseekharness\` |
| CLI 入口（asar 内） | `resources\app.asar\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js` |
| DSH_HOME | `F:\DSHDesktop\dsh-home` |
| desktop profile | `F:\DSHDesktop\dsh-home\profiles\desktop` |
| pnpm 可执行 | `...\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.cjs` |

注意：asar 内部文件**不能用 PowerShell 的 `Test-Path` 探测**，会得到假阴性；
必须用 `ELECTRON_RUN_AS_NODE=1` 配合 DSH 的 exe 去读。
