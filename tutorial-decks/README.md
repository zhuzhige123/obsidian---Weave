# 远端教程牌组资源

本目录是「在线获取教程牌组」的发布源文件，**不打进插件安装包**。

托管位置（推荐）：Weave 公开仓根目录 `tutorial-decks/`  
仓库：https://github.com/zhuzhige123/obsidian---Weave

## 语言（与插件 SupportedLanguage 对齐）

| locale | 牌组显示名 | 包 id |
| --- | --- | --- |
| zh-CN | Weave 入门教程 1.1 | weave-intro-zh |
| en-US | Weave Intro Tutorial 1.1 | weave-intro-en |
| ja-JP | Weave 入門チュートリアル 1.1 | weave-intro-ja |
| ko-KR | Weave 입문 튜토리얼 1.1 | weave-intro-ko |
| ru-RU | Обучающая колода Weave 1.1 | weave-intro-ru |
| es-ES | Tutorial introductorio de Weave 1.1 | weave-intro-es |

## 文件

- `catalog.json`：目录列表
- `packages/weave-intro-*.json`：各语言入门教程 **1.1**（约 58 张）

文稿真源：

- `../Weave-Deck-新手教程文稿.md`
- `../Weave-Deck-intro-tutorial-en.md`
- `../Weave-Deck-intro-tutorial-ja.md`
- `../Weave-Deck-intro-tutorial-ko.md`
- `../Weave-Deck-intro-tutorial-ru.md`
- `../Weave-Deck-intro-tutorial-es.md`

## 重新生成

```bat
node 10-Project-Weave\docs\tutorial-deck\build-remote-package.cjs
```

再把 `remote/` 内容同步到公开仓的 `tutorial-decks/`（只推教程资源，不推 `src/`）。

## 插件默认拉取顺序

1. **GitHub raw（优先，发版后立刻新鲜）**  
   `https://raw.githubusercontent.com/zhuzhige123/obsidian---Weave/main/tutorial-decks/catalog.json`
2. **jsDelivr（回退）**  
   `https://cdn.jsdelivr.net/gh/zhuzhige123/obsidian---Weave@main/tutorial-decks/catalog.json`

`@main` 的 jsDelivr 可能缓存较久。每次推送 `tutorial-decks/` 后建议 purge：

```bat
node scripts\purge-tutorial-deck-cdn.cjs
```

（或对 `catalog.json` 与各 `packages/*.json` 访问 `https://purge.jsdelivr.net/gh/zhuzhige123/obsidian---Weave@main/...`）
