# 远端教程牌组资源

本目录是「在线获取教程牌组」的发布源文件，**不打进插件安装包**。

托管位置（推荐）：Weave 公开仓根目录 `tutorial-decks/`  
仓库：https://github.com/zhuzhige123/obsidian---Weave

## 文件

- `catalog.json`：目录列表
- `packages/weave-intro-zh.json`：简体入门教程 **1.0**
- `packages/weave-intro-en.json`：英文入门教程 **1.0**

牌组显示名带版本号（如 `Weave 入门教程 1.0`），后续完善会升到 1.1 / 2.0 等。

## 重新生成

```bat
node 10-Project-Weave\docs\tutorial-deck\build-remote-package.cjs
```

再把 `remote/` 内容同步到公开仓的 `tutorial-decks/`。

## 插件默认拉取顺序

1. **jsDelivr（优先）**  
   `https://cdn.jsdelivr.net/gh/zhuzhige123/obsidian---Weave@main/tutorial-decks/catalog.json`
2. **GitHub raw（回退）**  
   `https://raw.githubusercontent.com/zhuzhige123/obsidian---Weave/main/tutorial-decks/catalog.json`

内容真源仍在 GitHub；用户端默认走 CDN，以降低中国大陆等地区访问 raw.githubusercontent.com 的不稳定问题。
