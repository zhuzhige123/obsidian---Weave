# 远端教程牌组资源

本目录是「在线获取教程牌组」的发布源文件，**不打进插件安装包**。

托管位置（推荐）：Weave 公开仓根目录 `tutorial-decks/`  
仓库：https://github.com/zhuzhige123/obsidian---Weave

## 文件

- `catalog.json`：目录列表
- `packages/weave-intro-zh.json`：简体入门教程牌组

## 重新生成

```bat
node 10-Project-Weave\docs\tutorial-deck\build-remote-package.cjs
```

再把 `remote/` 内容同步到公开仓的 `tutorial-decks/`。

## 插件默认目录 URL

`https://raw.githubusercontent.com/zhuzhige123/obsidian---Weave/main/tutorial-decks/catalog.json`
