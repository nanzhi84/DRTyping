# Prompt Palette

Chrome 扩展，用来保存常用 prompt，并在网页输入框里通过 `/` 触发一个就地命令面板，按方向键 / PgUp / PgDn 选择命令，Enter 插入多行文本。全部数据保存在浏览器本地 `chrome.storage.local` 中。

## Features

- **Slash command palette**：监听可编辑输入，输入 `/` 即在光标旁弹出命令列表，支持 PgUp/PgDn 与上下方向键循环选择，Enter 插入，Esc 关闭。
- **Per-site whitelist**：只在白名单域名上启用，避免影响其他站点。
- **Toolbar toggle**：点击浏览器工具栏图标即可对当前站点一键启停（会自动增删白名单）。
- **Command management UI**：Options 页面可创建/编辑/删除命令，仅列表显示名称，展开可查看完整内容。
- **Import/Export**：一键导入/导出 JSON，方便备份常用 prompt。
- **Local-first**：所有命令、站点配置都保存在本地，不向远端发送数据。

## Project Layout

```
├── manifest.json           # Manifest V3 配置
├── src/                    # TypeScript 源码
│   ├── content/            # 内容脚本与命令面板
│   └── storage/            # chrome.storage 封装
├── options/                # Options 页 HTML/CSS/TS
├── dist/                   # 构建产物（content/options/storage）
├── package.json
└── tsconfig.json
```

## Getting Started

1. **Load the extension in Chrome**

   仓库已包含可用的 `dist/` 产物，直接加载即可：

   - 打开 `chrome://extensions`
   - 开启 “开发者模式”
   - 选择 “加载已解压的扩展程序”，指向仓库根目录

2. **Configure commands**

   - 在扩展卡片点击 “详情” → “扩展选项”（或在工具栏图标上右键 -> `选项`）
   - 在 `Commands` 面板添加命令名称和多行内容
   - 在 `Site Whitelist` 添加允许触发扩展的域名（如 `chat.openai.com`）

## Usage

1. 打开已列入白名单的站点。
2. 聚焦任意 `<input>`、`<textarea>` 或 `contentEditable` 区域。
3. 输入 `/`，命令面板会在光标附近出现。
4. 用方向键或 PgUp/PgDn 选择，Enter 插入（会阻止页面自身的 Enter 行为），Esc 或点击空白关闭。

若想临时启停某个站点，可点击浏览器工具栏里的 Prompt Palette 图标，在弹出的面板中切换“Enable slash commands here”，扩展会自动把该域名加入/移出白名单。

## Development Notes

- 内容脚本入口：`src/content/listener.ts`
- 命令面板 UI：`src/content/palette.tsx` + `src/content/palette.css`
- 存储封装：`src/storage/commandStore.ts`
- Options 页面脚本：`options/options.ts`

修改 TypeScript 或 CSS 后运行 `npm run build`，再在 `chrome://extensions` 中点击 “重新加载” 以验证。

## Roadmap / Ideas

- 支持命令分组 & 搜索排序
- 自定义快捷键（例如 `Cmd+K` 打开面板）
- 多语言 UI 与同步备份
- 自动导入常见 prompt 模版

欢迎提交 Issue 或 PR！对功能需求有想法可以直接在 README 中列出 TODO，方便协作。
