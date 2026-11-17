# 04 · 模型接入：mode 清单、免 Key 规则、静默回退

来源：源码逐行读取 + 实际请求验证（2026-11-13/14）

## 四个能力的 mode 清单（`src/config.ts`）

```ts
VISION_MODES = ['deepseek-chat', 'openai-chat', 'mock']
IMAGE_MODES  = ['openai-images', 'modelverse-tasks', 'generic-rest', 'mock']
VIDEO_MODES  = ['openai-videos', 'modelverse-tasks', 'kling', 'kling-v3',
                'runway', 'minimax-h3', 'vidu', 'veo', 'generic-rest', 'mock']
AUDIO_MODES  = ['openai-tts', 'generic-rest', 'mock']
```

**结论：Vision 是唯一没有 `generic-rest` 的能力。** 本地视觉服务若不支持 OpenAI chat 协议，
就无法接入。

## 协议真相：Image 兼容，Video 不是

| 能力 | 默认 mode | 走的协议 |
|---|---|---|
| Image | `openai-images` | **标准** `POST /v1/images/generations`（OpenAI 兼容） |
| Video | `modelverse-tasks` | **私有** `POST /tasks/submit` + 轮询（非兼容格式） |
| Audio | `openai-tts` | 标准 `POST /audio/speech` |

所以**图片可以纯改配置换成任何 OpenAI 兼容厂商**（硅基流动、DashScope 兼容模式、火山方舟等，实测端点均可达）；
**视频不行**，除非改国内原生 mode（`kling` / `minimax-h3` / `vidu`）或用 `generic-rest` 自填适配规则。

## 免 Key 规则（`src/support.ts`）

```ts
export function isLocalBaseUrl(baseURL: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(baseURL)
}
```

实测判定：

| 地址 | 判定 |
|---|---|
| `http://localhost:11434/v1` | ✅ 本地，免 Key |
| `http://127.0.0.1:8000/v1` | ✅ 本地 |
| `http://[::1]:8080/v1` | ✅ 本地 |
| `http://192.168.1.100:11434/v1` | ❌ 当远程，必须填 Key |
| `http://10.0.0.5:1234/v1` | ❌ 同上 |
| `http://host.docker.internal:11434/v1` | ❌ 同上 |

**局域网 / Docker / WSL 地址会被当远程**。本地服务通常不校验 Key，填个占位符（如 `sk-local`）即可绕过。
代码里**没有 HTTPS 强制**。

## 静默回退（安全性隐患）

```ts
const candidates = [...envNames, 'MODELVERSE_API_KEY', 'AIGW_API_KEY', 'OPENAI_API_KEY']
const fromEnv = candidates.map(n => process.env[n]).find(v => v !== undefined && v !== '')
const key = configApiKey !== '' ? configApiKey : fromEnv ?? ''
```

**API Key 输入框留空时会静默回退到环境变量。** 各能力回退链：

| 能力 | 优先 | 回退 |
|---|---|---|
| Vision（deepseek-chat） | `MONT_VISION_API_KEY` | **`DEEPSEEK_API_KEY`** |
| Vision（openai-chat） | `MONT_VISION_API_KEY` | `OPENAI_API_KEY` |
| Image | `MONT_IMAGE_API_KEY` | `OPENAI_API_KEY` |
| Video | `MONT_VIDEO_API_KEY` | `MONT_IMAGE_API_KEY` / `MONT_AUDIO_API_KEY` |
| Audio | `MONT_AUDIO_API_KEY` | `OPENAI_API_KEY` |

**风险**：DSH 会把 `.credentials.yaml` 里的 `DEEPSEEK_API_KEY` 注入进程环境，所以 Key 留空时
Vision 会借用 DSH 自己的 Key，而 UI 上没有任何提示。**建议改进：在设置卡片显示实际生效的 Key 来源。**

## 出厂默认值不合规（待改）

`src/config.ts` 第 45-47 行三个能力的默认值全部指向 `https://api.modelverse.cn/v1`：

| 能力 | 默认 model | 问题 |
|---|---|---|
| Image | **`gpt-image-2`** | OpenAI 模型，经境内中转转售 |
| Video | `doubao-seedance-2-0-260128` | 豆包（国内模型，OK） |
| Audio | `qwen3-tts-flash` | 千问（国内模型，OK） |

Image 默认值应改为国内厂商，建议 `Kwai-Kolors/Kolors` 或 `Qwen/Qwen-Image`。
