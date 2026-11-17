# 07 · 与 OpenFilm 对比：三个真实缺口

来源：抓取 openfilm/openfilm 的 README.zh-CN.md + 本项目源码实测（2026-11-17）

## 对比对象

[openfilm/openfilm](https://github.com/openfilm/openfilm) —— 开源 AI 视频智能体，定位「让任何编程智能体都能做视频，再配编辑器」。

它的核心设计与 MontageX 不同层面：**OpenFilm 强在工程化交付，MontageX 强在导演知识。**

## 能力对照表

| 机制 | OpenFilm | MontageX | 判定 |
|---|---|---|---|
| 导出到专业剪辑软件 | FCP / Premiere / Resolve | **无** | **硬缺口** |
| 用户手动改动不被覆盖 | `overrides` 层 | 无 | **硬缺口** |
| 素材按引用而非复制 | 链接，挪位置能找回 | `copyFile` 复制进项目 | 中等 |
| frame(t) 确定性渲染 | 每镜头是网页 + 纯函数 | 有 ffmpeg 确定性但非此语义 | 设计差异 |
| 单文件声明式工程 | `film.html` | `canvas.json` | 形态差异，非缺陷 |
| README 多语言 | **22 种** | 2 种（中/英） | 传播差距 |
| 导演知识库 | 无 | **358 篇 + 56 技能 + 15 配方** | **本项目优势** |

## 缺口一：NLE 导出（最该补）

**实测确认完全缺失**：`fcpxml` / `premiere` / `davinci` / `aaf` 在 `src/` 下**均为 0 处**。

（注意：粗搜时 `otio` 有 145 处、`EDL` 有 32 处命中，但**全是误报**——
命中的是 `Motion`、`methods`、`resolveXxx` 等词里的子串。不要被误导。）

**为什么重要**：AI 生成的片子不可能一次到位。剪辑师拿到成品要进 Premiere 精修，
现在只能拿到 mp4，无法继续加工。这是与专业工作流的唯一断路。

**建议**：优先实现 **FCPXML**——纯 XML、规范公开、实现量最小，Resolve 和 Premiere 都能导入。
一个时间线 + 片段起点时长 + 音量就够起步。

## 缺口二：overrides 层（协作场景致命）

OpenFilm 的设计原文：

> **你的改动不会丢。** 你在镜头里亲手改的文字、颜色、位置、大小，OpenFilm 存在片段的
> `overrides` 里，不动页面代码。智能体重写页面以后，你的改动照样生效。

**MontageX 的问题**：`canvas.json` 由智能体全量写入。用户手动调整了某个镜头位置后，
智能体下次改分镜会**整体覆盖**，用户的调整丢失。这在已做了团队协作层的情况下尤其危险。

**最小实现**：给 `CanvasNode` 加 `overrides?: Record<string, unknown>`，
写画布时先合并 overrides 再落盘。

## 缺口三：素材引用

当前实现把素材 `copyFile` 进项目目录（见 `src/stage-server.ts`、`src/series.ts`）。
用户素材库若为 100 GB，每个项目都复制一份不可接受。

**建议**：改用 junction（Windows）/ symlink，或存相对路径 + 校验和定位。
OpenFilm 的做法是链接不复制，并且用校验和保证「挪了位置也能找回」。

## 明确不建议抄的三项

1. **不要抄 `film.html` 架构。** 那是「镜头即网页」的整套渲染层重建，
   与现有 `canvas.json` + ffmpeg 管线是两条路，换过去等于重写。
2. **不要急着实装 frame(t)。** 它解决「同一时刻在任何机器渲染出同一帧」，
   ffmpeg 已提供确定性，收益远小于 NLE 导出。
3. **多语言可以缓。** 22 种是面向全球社区的结果，刚上架 2 种够用。若做国际化，是纯翻译的低成本高回报项。

## 战略判断

OpenFilm 通篇**没有导演方法论**。它教「怎么让 agent 做出片子」，
MontageX 的 358 篇知识库教「什么样的片子是好片子」——运镜、布光、节奏、混音、叙事。

**这是本项目的护城河。别为了对齐 OpenFilm 的工程能力，把自己变成第二个 OpenFilm。**
