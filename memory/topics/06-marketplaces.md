# 06 · 分发渠道状态

来源：本会话逐渠道实测（2026-11-18）

## 三个渠道的现状

| 渠道 | 状态 | 版本 |
|---|---|---|
| **npm** | ✅ 已发布 | `0.2.2`（versions: 0.0.0-stage, 0.2.0, 0.2.1, 0.2.2） |
| **GitHub** | ✅ 已发布 | `0.2.2`（Release 提交 `1b853df`） |
| **dsh-market** | ✅ 已收录 | 见下 |

## dsh-market 的关键机制

索引条目（从 `awesome-dsh-plugin.com/plugins.json` 下载，共 11332 条）里 montagex 的记录：

```json
{
  "name": "dsh-montagex",
  "owner": "royrao2007",
  "category": "workflow",
  "npm": null,
  "version": null,
  "install": "dsh plugin --profile web add github:royrao2007/dsh-montagex",
  "added": "2026-11-14",
  "capabilities": ["shell","dynamic-code","fs-write","fs-read","network","env"],
  "capabilityRedLines": []
}
```

**两个要点：**
1. **`version: null`——市场不记录版本号。** 安装时直接从 GitHub 默认分支拉代码。
   所以「market 上的版本」= 「安装那一刻 GitHub main 的版本」。
   → 推代码到 GitHub 后，市场用户下次安装即可拿到，**不需要等 npm 发版**。
2. **能力审计已通过**：6 项能力，`capabilityRedLines` 为空（无红线）。

## awesome-dsh-plugin 上架经过

- PR **#14871**，2026-11-14 17:14 UTC **已合并**。
- 提交文件：`data/plugins/royrao2007__dsh-montagex.yml`（639 字节）。
- 曾唯一失败的门槛：**仓库年龄需满 24 小时**。官方检查器原文：
  > nothing to do: this check re-runs by itself and should clear in about 10h.
  > No need to resubmit, push, or close and reopen

  即**不需要重提交**，自动重跑即可通过。

## 条目格式（format 1）

```yaml
url: https://github.com/royrao2007/dsh-montagex
name: royrao2007/dsh-montagex
category: workflow
description:
  en: '...'
  zh: '...'
```

注意：`description` 里若以 `: ` 结尾必须加引号。分类 `workflow` 是合法的（官方仓库里有真实在用的条目）。

## 其他渠道

- **dshfind**（hikariming）：每日 02:17 UTC 同步 GitHub `dsh-plugin` topic，无需 PR。
- **imsai / dshopen.org**：靠 topic 自动抓取或提 issue。
- 以上均依赖仓库的 `dsh-plugin` topic（已设，共 8 个 topics）。

## 曾犯的错误

把 MontageX 和 Mont Forge 混为一谈过——用户明确纠正：「不是，现在怎么扯到 Mont Forge 了，不是在弄 MontageX 吗？」
两者是**不同项目**，Mont Forge 的文件已移到 `F:\DSHDesktop\chajian\mont-forge-market\` 独立处理。
