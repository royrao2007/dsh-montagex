# 02 · inject 缺 webServer —— 本会话最大的坑

来源：源码定位 + 路由实测（2026-11-13，DSH 0.2.2-rc.2）

## 症状（极具误导性）

设置页「测试连接」、模型接入表单、以及所有画布请求全部失败，浏览器只显示：

```
Failed to execute 'json' on 'Response': Unexpected end of JSON input
```

这个错误**完全不指向真正原因**。我最初被它误导，先后误判为：
- ❌ 模型名不对（实际是鉴权/路由问题）
- ❌ 需要重新发布 npm 包（部分正确但不是这个）
- ❌ API Key 无效

## 真正的根因

`src/index.ts` 第 33 行原本是：

```ts
export const inject = ['tools', 'skills', 'systemPrompt', 'settings', 'llm']
```

**没有 `webServer`。**

Cordis 因此在 HTTP 服务就绪**之前**执行 `apply()`，`ctx.get('webServer')` 返回 `undefined`，
于是 18 个 `register*Route` 全部命中这个守卫并静默返回空 disposer：

```ts
if (webServer === undefined) return () => {}
```

**路由从未注册。** 而 `dsh-host-webserver` 对未匹配路由回 `404` 且 `res.end()` 无 body，
客户端对空 body 调 `.json()`，才产生了那句「Unexpected end of JSON input」。

## 修复

```ts
export const inject = [
  'tools', 'skills', 'systemPrompt', 'settings', 'llm',
  'webServer',      // ← 必须有
  'configEditor',   // ← 保存配置必须有
]
```

验证依据：DSH 自己的 `dsh-web-app`、`dsh-host-frontend-static`、`dsh-client-hmr` 等
都声明了 `inject = [..., "webServer"]`。

## configEditor 同理

`settings-bridge.ts` 的 `persistEntryConfig` 需要 profile 的配置编辑器：

```ts
const editor = ctx.get('configEditor')
if (entry === undefined || editor === undefined) throw new Error('...没有可写的配置编辑器...')
```

缺失时**保存会失败**，而 UI 已经把新值显示出来了——用户看到的是「保存中...」卡住。
DSH 自己的 `dsh-settings` 也把 `configEditor` 放进 `inject`。

## 刻意不注入的两个服务

| 服务 | 缺失时行为 | 决定 |
|---|---|---|
| `workspace` | 降级为磁盘扫描（`listProjectsFromDisk`） | 不注入 |
| `subagents` | 明确注释「graceful degrade」，返回值空 disposer | 不注入 |

两者都有文档化的降级路径，注入它们只会拖慢插件加载。

## 附带修的客户端缺陷

`src/client/stage/Stage.tsx:759` 原代码：

```ts
void fetch('/montagex/projects').then(item => item.json())
  .then(...).catch(() => {})     // ← 404 被空 catch 吞掉
```

改为先查 `response.ok` 再解析，并把原因 `console.warn` 出来。
