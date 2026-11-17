# MEMORY.md · dsh-montagex 长期记忆索引

> **索引，不是仓库。** 每项一句话 + 链接到 `memory/topics/` 的具体文件。
> 只放「已确认、可长期复用」的结论；不放原始聊天记录。

## 项目身份

- 仓库 `royrao2007/dsh-montagex`，包名 `dsh-montagex`，当前 **0.2.2**，medium：npm + GitHub + dsh-market 三渠道同步 → [topics/01-project-identity.md](memory/topics/01-project-identity.md)
- 许可分层：DirectorX 派生部分 Apache-2.0 + 团队协作模块 MIT，声明在 NOTICE → [topics/01-project-identity.md](memory/topics/01-project-identity.md)
- 能力规模：161 工具（153 制作 + 8 团队）、358 知识篇、56 技能、15 配方 → [topics/01-project-identity.md](memory/topics/01-project-identity.md)

## 关键修复（血泪教训）

- **`inject` 必须含 `webServer`**，否则 18 个 `/montagex/*` 路由全部静默不注册 → [topics/02-inject-webserver.md](memory/topics/02-inject-webserver.md)
- **错误提示会骗人**：路由 404 空响应体被 `.json()` 解析 → 显示「Unexpected end of JSON input」，与真实原因无关 → [topics/02-inject-webserver.md](memory/topics/02-inject-webserver.md)
- **`inject` 也要含 `configEditor`**，否则设置保存失败 → [topics/02-inject-webserver.md](memory/topics/02-inject-webserver.md)

## 安装机制（本机实测）

- `dsh plugin --profile desktop` 被设计性拒绝，desktop profile 只能走 GUI 或 pnpm 直装 → [topics/03-install-mechanics.md](memory/topics/03-install-mechanics.md)
- 两种必遇报错：`ERR_PNPM_IGNORED_BUILDS`（canvas 构建）与 `ERR_PNPM_EPERM`（DSH 运行时句柄占用） → [topics/03-install-mechanics.md](memory/topics/03-install-mechanics.md)
- `canvas` 是 `fabric`→`tui-image-editor` 的可选原生依赖，需 `allowBuilds: {canvas: false}` → [topics/03-install-mechanics.md](memory/topics/03-install-mechanics.md)

## 模型接入真相

- 四个能力的 mode 清单；**Vision 没有 `generic-rest`**，是唯一不支持通用适配的能力 → [topics/04-model-providers.md](memory/topics/04-model-providers.md)
- 免 Key 只认 `localhost` / `127.0.0.1` / `[::1]`，**局域网 IP 一律当远程**（需填占位 Key） → [topics/04-model-providers.md](memory/topics/04-model-providers.md)
- API Key 留空会**静默回退**到 `DEEPSEEK_API_KEY` 等环境变量，等于借用 DSH 的 Key → [topics/04-model-providers.md](memory/topics/04-model-providers.md)
- Image 是 OpenAI 兼容接口（可换国内厂商）；Video 默认 `modelverse-tasks` 是私有提交-轮询协议 → [topics/04-model-providers.md](memory/topics/04-model-providers.md)

## 发版与推送纪律

- 改动验证通过即 commit + push；每次优化必须升版本号；三处版本同步 → [topics/05-release-discipline.md](memory/topics/05-release-discipline.md)
- 本机 `git push` 走 443 会失败，改用 Git Data API；大文件必须走 raw 端点验证 → [topics/05-release-discipline.md](memory/topics/05-release-discipline.md)

## 分发渠道

- dsh-market 收录条目 **不记录版本号**，安装时拉 GitHub main → [topics/06-marketplaces.md](memory/topics/06-marketplaces.md)
- awesome-dsh-plugin PR #14871 已合并；仓库年龄门槛 24h 是唯一曾挡住的门 → [topics/06-marketplaces.md](memory/topics/06-marketplaces.md)

## 竞品与优化方向

- OpenFilm 对比结论：**NLE 导出（FCPXML）是最大硬缺口**，其次是 overrides 层、素材引用 → [topics/07-openfilm-comparison.md](memory/topics/07-openfilm-comparison.md)
- 不要抄 `film.html` 架构与 frame(t)；导演知识库（358 篇）是本项目护城河 → [topics/07-openfilm-comparison.md](memory/topics/07-openfilm-comparison.md)

## 维护规则

- 每条记忆必须有来源（本会话实测 / 源码行号 / 用户明确口述）。
- 与现有条目冲突的新记录并列保留并标 `conflict`，等人裁定。
