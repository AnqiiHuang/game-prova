# 逃离幸福小区

> 纯属虚构的互动文字游戏。手机竖屏优先，单人，约 40–60 分钟可以通关一次。

你是回家过假期的大学生。走进“幸福小区”的那一刻，只有你能听见一个声音：

> 欢迎来到幸福小区。你需要在七天内找到离开的办法。超过期限，本局游戏结束。

家里留给你五条家规，其中有一条是假的。你要在七天里找出它，办好离开小区需要的手续。

整个游戏是纯前端网页：**不需要 API Key、不需要登录、没有后端、没有数据库，也不会联网请求任何东西。**

---

## 一、第一次使用（零基础版）

### 1. 安装 Node.js

到 <https://nodejs.org> 下载 **LTS** 版本（18 或更新）并安装。装完后打开终端（macOS 的“终端”，Windows 的“PowerShell”），输入：

```bash
node -v
```

能看到版本号（比如 `v20.x.x`）就成功了。

### 2. 安装依赖

在项目文件夹里运行：

```bash
npm install
```

### 3. 本地试玩

```bash
npm run dev
```

终端会显示一个地址（一般是 `http://localhost:5173`），用浏览器打开就能玩。想用手机看，让手机和电脑连同一个 Wi-Fi，然后用 `npm run dev -- --host` 启动，手机浏览器打开终端里显示的 `Network` 地址。

### 4. 打包成网页

```bash
npm run build
```

成功后会生成 `dist/` 文件夹，里面就是可以直接上传的网站文件。想在本机预览打包后的效果：

```bash
npm run preview
```

---

## 二、检查命令

| 命令 | 作用 |
| --- | --- |
| `npm run check:story` | 剧情体检：默认可见正文按篇幅分档（普通节点约 180–470 字，重要节点约 520–900 字，“展开细节”另算且有上限）、选项 2–4 个、没有断链、没有禁用词 |
| `npm test` | 单元测试：时间、饮食、商店、存档、失败次数、地点与在场人物、反馈清理、材料显示、家规标记、五位帮助者 × 三档幸运的机器人通关、分享图排版 |
| `npm run build` | 类型检查 + 打包 |
| `npm run check` | 依次运行以上三项 |

> 说明：`check:story` 使用 `node --import tsx` 运行。如果你的环境里直接用 `tsx` 命令报 `EPERM`（沙盒限制），用 `npm run check:story` 即可，不受影响。

---

## 三、存档与“清除试玩进度”

进度保存在**你自己浏览器的 localStorage** 里，不会上传到任何地方。用到的键都以 `xfq.v1.` 开头：

- `xfq.v1.cache`：自动存档（每次有效操作后更新）
- `xfq.v1.sleep`：最近一次“睡觉并存档”
- `xfq.v1.start`：本局开局的还原点
- `xfq.v1.meta`：失败次数等不会随读档回滚的信息
- `xfq.v1.settings`：字号、主题等设置

清除试玩进度有两种方法：

1. 游戏里：打开底部“设置”面板，点“放弃本局并重新开始”。
2. 浏览器里：开发者工具 → Application（应用）→ Local Storage → 删除以 `xfq.v1.` 开头的条目。

规则提醒：失败 1–3 次可以读档重来，**失败次数不会因读档而清零**；第 4 次失败本局结束。第七天到 24:00 仍未离开，本局结束，存档作废。

如果浏览器禁用了本地存储（比如某些隐私模式），游戏会自动进入“临时试玩模式”：能玩，但关闭页面后进度不保留，界面上有提示。

---

## 四、仅开发环境的调试工具

`npm run dev` 启动时，“开始游戏”页底部会多出一个“开发调试”折叠区，可以固定随机种子、指定帮助者和幸运档。**打包后（`npm run build`）这些功能不会出现，也不会被打进正式文件。**

快速跳转到指定天数的函数只在测试里使用（`tests/`），没有放在页面上。

---

## 五、发布到 GitHub Pages

线上地址：<https://anqiihuang.github.io/game-prova/>

- `vite.config.ts` 里 `base` 设为 `'/game-prova/'`，打包后的 JS/CSS 路径都以 `/game-prova/assets/` 开头。如果仓库改名，要同步修改这里。
- `.github/workflows/deploy.yml` 会在推送到 `main` 时自动：安装依赖 → 剧情体检 → 单元测试 → `npm run build` → **只上传 `dist/`** → 发布。源码不会被发布。
- 第一次使用需要在 GitHub 仓库里手动设置一次：**Settings → Pages → Build and deployment → Source 选 “GitHub Actions”**。如果之前选的是 “Deploy from a branch”，页面会直接展示源码里的 `index.html`（引用 `/src/main.tsx`），导致 404，必须改掉。
- 本地预览带前缀的效果：`npm run build && npm run preview`，然后打开 `http://localhost:4173/game-prova/`。

本项目不会替你创建账号、购买服务或自动发布到小红书，也不收集任何账号信息。

## 六、项目结构

```text
docs/story-bible.md        内部剧情设定（人物、真假家规的证据链、七天时间线）
src/game/types.ts          数据类型
src/game/random.ts         可保存的随机数（固定种子可复现）
src/game/engine.ts         纯函数引擎：时间、数值、商店、饮食、结局判定
src/game/session.ts        存档会话：自动存档、睡觉存档、失败次数、读档
src/game/storage.ts        带版本号的 localStorage，损坏数据不白屏
src/game/story/            七天剧情节点、支线、对话、结局
src/components/            页面组件（只通过 useGame() 访问状态，不直接碰存储）
src/utils/shareImage.ts    本地 Canvas 分享图（1080×1440，三种模板）
scripts/check-story.ts     剧情体检脚本
tests/                     单元测试
```

## 七、已知限制

- 恐惧满格、健康归零这两种失败结局，只会在长期不休息、不吃饭时才会出现，正常通关很难碰到；它们由测试覆盖。
- 没有在真实手机上测试；浏览器里用 360 / 390 / 430 px 宽度验证过无横向溢出。
- 分享图由浏览器 Canvas 本地生成，字体使用系统自带中文字体，不同设备上字形会略有差异。
