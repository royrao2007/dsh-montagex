# Changelog

本文件记录 dsh-montagex 的用户可见变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

### Fixed

- **安装不再因 `canvas` 构建被拦而失败**：`canvas` 经 `fabric`（`tui-image-editor`）引入，是可选原生依赖，Windows 上常编译失败；pnpm 11 会把未批准的构建脚本视为错误，导致安装被判定失败。README 现记录两种常见报错的处置方式——
  `allowBuilds: { canvas: false }` 用于消除 `ERR_PNPM_IGNORED_BUILDS`；完全退出 DSH 后再安装，用于消除 `ERR_PNPM_EPERM`（运行时目录句柄被占用，pnpm 无法把 `_tmp_` 目录改名为正式目录）。两者均不影响装好后的使用。

### Added

- **DeepSeek 第一方多模态（适配 DSH 0.1.1-rc.1）**：Vision 新增 `deepseek-chat` 模式并设为默认，直连官方 `https://api.deepseek.com` chat 协议，默认模型 `deepseek-v4-flash-vision-exp`（宿主 0.1.1-rc.1 在 `deepseek-official` 路由发布的第一方视觉模型，`inputModalities: text+image`）。对齐上游线格式：图片一律内联为 `image_url` data URL（PNG/JPEG/WebP/GIF；15 MiB 原始 ≈ 上游 20 MiB base64 载荷上限），不发外部 URL；Key 回退 `DEEPSEEK_API_KEY`（与 DSH 同一凭据）。接入分诊（classify）新增第一方指纹，设置页 Vision 默认值与模型候选同步更新，连接测试兼容该端点。
- **一句话视频工作坊**：画布会话坞新增六步工作坊、参考视频分析、一键粗剪和一键交付快捷入口；长 assistant 回复默认折叠，运行状态改为导演语义。
- **高频生产工具**：新增 `mont_media_scene_split`、`mont_media_auto_cut`、`mont_media_batch`、`mont_media_package`，复用现有 FFmpeg、`smart_cut`、`video_process`、`video_concat` 和抽帧管线，覆盖检查帧、区间/脚本粗剪、批量拼接/标准化、预告与封面交付。

### Changed

- **适配 DeepSeek Harness 0.1.1-rc.2**：核对上游 rc.1 → rc.2 差异，插件 API 无破坏性变更（`tools` / `skills` / `systemPrompt` / `settings` / `llm.registerConfigurableProviders` / `userQuestions` 未变；宿主 `llm` 服务新增 `prepareCall` / `PreparedAdapterCall` 与图片卸载策略，均为加法；`dsh-client-connection` 默认 `/api` 请求体上限 160 MiB → 300 MiB、`session.create` 移除 `reuseWorkspaceBlank` 字段，插件均未使用），宿主最低版本要求提到 0.1.1-rc.2（`@deepseek-ai/dsh@next`）。
- **适配 DeepSeek Harness 0.1.1-rc.1**：核对上游 rc.8 → rc.1 差异，插件 API 无破坏性变更（`tools` / `skills` / `systemPrompt` / `settings` / `llm.registerConfigurableProviders` / `userQuestions` 服务源码未变；webserver 新增结构化 index 注入但 `tapIndex` 保留），宿主最低版本要求提到 0.1.1-rc.1（`@deepseek-ai/dsh@next`）。
- **适配 DeepSeek Harness 0.1.0-rc.8**：提问走官方 `userQuestions`（仍兼容旧名 `userInteraction`）；设置页读 `settingsScope` 共享镜像，不再在冷启动多打一次 `settings.describe`；`/montagex` 斜杠菜单挂 `commandUi` 并通过 `remote.commands.execute` 下发。客户端 `dsh.client.immediately` 开机预取，inject 补上 settings / commands / remotes。
- **重新生成**：不再弹独立对话框，改为选中节点下方生成坞（带「重新生成」标记），只改这一镜。
- **智能解析**：先出分镜条（时间窗 / 代表帧），确认后才「应用到画布」。
- **图片 / 视频编辑台**：顶栏撤销重做与「完成」；图片右侧只显示当前工具；视频拆成剪辑 / 调色，调色只改预览，保存才回写画布。
- **视频时间线**：片段按播放顺序排在 V1 / A1 轨上，可分割、拖移调序、拉出入点、变速、淡入淡出、静音；导出可选分辨率 / 画质 / 帧率 / 硬切或叠化，并支持保存到画布或下载文件。

### Fixed

- **CI**：Ubuntu runner 补装 ffmpeg；音频 mock 假数据小于 1KB 时不再被 `openaiTts` 当成失败。
- **audioMix**：侧链闪避先 `asplit` 人声，不再把同一条滤镜标签喂给 compress 和 amix（ffmpeg 7 会当成流选择器）。

## [0.2.2] - 2026-11-14

首个真正带上路由修复的发布版本。`0.2.1` 发布时该修复尚未进入构建产物，
因此 `0.2.1` 的 `inject` 仍缺少 `webServer`，所有 `/montagex/*` 路由都不会注册。

### Fixed

- **`inject` 补上 `webServer`**：此前 `apply()` 在 HTTP 服务就绪前执行，`ctx.get('webServer')` 返回 `undefined`，18 个 `register*Route` 静默返回空 disposer，路由从未注册；`0.2.2` 起全部注册。
- **`inject` 补上 `configEditor`**：保存配置需要 profile 的配置编辑器，缺失会让保存在 UI 已显示新值之后失败。
- **客户端补状态码检查**：`src/client/stage/Stage.tsx` 的项目列表请求此前把 404 吞进空 `catch`，失败不可见；现在先查 `response.ok` 再解析，并把原因写进控制台。

### Release

- 发布 **GitHub Release v0.2.2** 与 npm `dsh-montagex@0.2.2`，两处版本号与产物一致；画布菜单与设置页文案随本次修复一并校正。

## [0.2.1] - 2026-11-13

### Fixed

- **设置页与所有 `/montagex/*` 路由终于真的注册了**：插件的 `inject` 少了 `webServer`，于是 `apply()` 在 HTTP 服务就绪前执行，`ctx.get('webServer')` 返回 `undefined`，18 个 `register*Route` 全部静默返回空 disposer。表现为「测试连接」「接入新模型」以及画布请求一律失败，浏览器只看到 `Failed to execute 'json' on 'Response': Unexpected end of JSON input`——因为服务器对未注册路由回 404 且空响应体。
- **安装文档里两个会误导的表述**：双协议镜像前缀与 ssh 远端地址都不被输入框接受，README 现改用不含主机名的说法，避免用户照抄后撞上 `a URL must point at a git repository or a tarball`。
- **安装失败的两个常见报错写进 README**：`ERR_PNPM_IGNORED_BUILDS`（`canvas` 构建被拦）与 `ERR_PNPM_EPERM`（DSH 运行时占用目录句柄），各给出一条处置办法，并说明两者都不影响装好后的使用。
### Release

- 发布 **GitHub Release v0.2.1** 与 npm `dsh-montagex@0.2.1`；注意该版构建产物尚未包含 `webServer` 注入修复，路由修复见 `0.2.2`。

## [0.2.0] - 2026-11-12

### Changed

- **改名与独立发布**：项目更名为 **MontageX**，工具前缀统一为 `mont_`，包名 `dsh-montagex`，插件 id 与设置命名空间均为 `montagex`。
- **适配 DSH 0.2.2-rc.2**：移除已删除的 `ctx.settings.register`，改为导出 `Config` 并由 `apply(ctx, config)` 接收；能力字段标记为活值，设置页保存后无需重启即可生效。
- **设置页改走 0.2.x 契约**：浏览器侧由已移除的 `settingsScope` 改为 `ctx.configForms`，只注册 `settings.section`。

### Added

- **团队协作**（MIT）：新增 8 个 `mont_team_*` 工具——角色权限、镜头认领、镜头级批注、阶段签核闸。未解决的修改要求会阻塞签核，看板以纯数据落在 `<outputDir>/team/` 下，可随目录共享。

### Fixed

- 关闭某个能力后，其对应工具立即从工具目录消失，不再需要重启。
- 工具清单冻结快照同步更新至 161 个（153 继承 + 8 团队）。

### Release

- 首发 **GitHub Release v0.2.0**，产物见 Releases 页；画布菜单文案随品牌统一更新。

## [0.1.0] - 初始版本

- 六个工具：`mont_view_image` / `mont_generate_image` /
  `mont_generate_video` / `mont_generate_audio` /
  `mont_knowledge_search` / `mont_knowledge_read`。
- 四类能力独立开关与热更新；`openai-chat` / `openai-images` / `openai-videos` /
  `modelverse-tasks` / `openai-tts` / `mock` 协议适配。
- 351 篇影视知识库、36 个 runtime skills、8 大中文影像工坊、11 套 recipes、
  `montagex-playbook` 原创制作手册。
- Settings → MontageX WebUI 设置页（secret API Key、能力开关、即时生效）。
