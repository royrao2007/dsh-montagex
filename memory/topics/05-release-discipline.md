# 05 · 发版与推送纪律

来源：用户 2026-11-13 明确要求 + 本机实操验证

## 用户定的两条铁律

**① 改动验证通过后必须立刻 push，不要停留在本地。**
用户多次追问「修了 push 了吗」——默认期望就是「改完即推」。
推送后必须用远端 API 回读验证内容确实落地，不能只看 push 命令返回。

**② 每次优化/修复都必须提升版本号。**
不允许同版本号重复发布或改动已发布内容。交付时三处版本必须一致：

1. `package.json` 的 `version`
2. `CHANGELOG.md` 增加对应版本段（**必须含 Release 行**）
3. GitHub 与 npm **双渠道**发布同一版本

npm 不允许覆盖已发布版本，必须升号。发版前核对 npm 上该版本未被占用。

## 本机的 git 传输问题

`git push` over `https://github.com:443` 会间歇性失败，两种表现：
- `Recv failure: Connection was reset`
- `fatal: Authentication failed`

**解法：走 GitHub Git Data API**（blob → tree → commit → ref）。
关键点：API 推送产生的 commit SHA 与本地不同，但内容一致；
下次推送时 parent 必须用**远端 tip**，不能用本地父提交，否则会被保护逻辑拒绝。

## 大文件验证的陷阱（曾误判两次）

GitHub contents API 对 **>1 MB 的文件返回 `encoding: "none"` 且 content 为空字符串**。
这**不是文件被截断成 0 字节**，而是内容未随 API 返回。

正确做法：改用 `https://raw.githubusercontent.com/<owner>/<repo>/main/<path>` 取真实字节，
用 `Buffer.compare(remote, local) === 0` 做字节级比对。

`lib/index.js` 约 1.78 MB，每次发版都必须这样验证。

## npm 发布的两个坑

**坑一：`PUT 202` 只是受理回执，不是已生效。**
发布后 `dist-tags.latest` 可能仍是旧版本，通常需要数分钟传播。
判断依据不能只靠 packument，要同时查：
- `https://registry.npmjs.org/<pkg>/<version>`（具体版本端点）
- tarball HEAD 请求

**坑二：本机全局 registry 指向 npmmirror 镜像。**
发布时必须显式指定：

```bash
npm publish --registry=https://registry.npmjs.org/
```

否则会打到镜像。回读也要打官方 registry，不要信 `npm view` 的缓存。

**坑三：`fetch` 对 npm CDN 的 tarball 可能只返回 21 字节错误响应。**
改用 `node:https` 下载，并对 `<100 KB` 的包体主动报错（正常包约 14.6 MB）。

## CHANGELOG 的隐性测试要求

`tests/release-notes.test.mjs` 要求每个版本段里必须出现 `画布菜单` / `菜单文案` / `GitHub Release` 之一。
新增版本段时若漏了 Release 行，测试会失败。

另外 `CHANGELOG` 段顺序必须是**最新在前**，重复段会被外链测试连带影响。
