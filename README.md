# Weave Deck

[English](#english-documentation) · [简体中文](#中文文档) · [Русский](README.ru.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [官网](https://obsidian-weave.xyz/#pricing) · [使用教程](https://obsidian-weave.xyz/tutorials.html#welcome)

<div align="center">

<img src="https://img.shields.io/badge/简体中文-2d333b?style=flat-square" alt="简体中文" /> <img src="https://img.shields.io/badge/English-2d333b?style=flat-square" alt="English" /> <img src="https://img.shields.io/badge/日本語-2d333b?style=flat-square" alt="日本語" /> <img src="https://img.shields.io/badge/한국어-2d333b?style=flat-square" alt="한국어" /> <img src="https://img.shields.io/badge/Русский-2d333b?style=flat-square" alt="Русский" /> <img src="https://img.shields.io/badge/其它语言_后续支持-6b7280?style=flat-square" alt="其它语言后续支持" />

<br/>

![weave-series-banner-trinity](https://github.com/user-attachments/assets/8f748341-bb83-4cf9-b020-d8cd18a2aa92)

![weave-plugin-banner-deck](https://github.com/user-attachments/assets/2bd06511-2e12-4719-a4ae-64e590040986)

![weave-plugin-banner-deck](https://github.com/user-attachments/assets/767fd9be-6a9f-454b-8109-55a0b8c1adec)

![QQ20260915-040906-HD](https://github.com/user-attachments/assets/500543b4-f7c8-4cdb-a3f1-d551ff16559f)

![QQ20260915-042426-HD](https://github.com/user-attachments/assets/69004ae6-dd88-447c-ba46-c4dbe73660b7)

![QQ20260915-041103-HD](https://github.com/user-attachments/assets/37f11676-119c-4549-b731-6a356d3ce815)

![QQ20260915-041759-HD](https://github.com/user-attachments/assets/4ee38da8-c6f6-42b5-af7c-3992577cfca4)

</div>

---

## English Documentation

### Overview

**Weave Deck** embeds spaced review in Obsidian’s file world: memory cards grow from your notes, stay linked to them, and can jump back to the source when you review. You write in Markdown; the plugin parses and previews that structure as question types—instead of Anki-style field forms. Editing and display use Obsidian’s own editor and rendering, so community plugins can extend the same loop. Data stays local in your vault.

| Concept | Meaning |
|---------|---------|
| **Memory card** | A reviewable item authored as Markdown structure, linked to its source |
| **Memory deck (`.wdeck`)** | Container for cards; formal and reference-based membership |
| **Trace** | Jump back from a card to the exact source passage when you need context |

It is the memory plugin in the **Obsidian Weave series** (exactly three: Weave Deck, Weave EPUB Reader, Weave Incremental Reading). Use it alone for Markdown cards and FSRS review; add the other two when you need in-vault reading or incremental reading queues.

Minimum Obsidian version: **1.7.0**. Desktop and mobile are supported.

Tutorials: [Weave Deck tutorials](https://obsidian-weave.xyz/tutorials.html#welcome). Pricing: [Website · Pricing](https://obsidian-weave.xyz/#pricing).

#### Four principles

1. **Cards from files, linked to files** — review and notes are not two disconnected worlds.
2. **Traceability** — answers keep the context they came from.
3. **Markdown thinking, not form-field thinking** — author structure like a note; parsing turns it into a question.
4. **Expand through Obsidian’s ecosystem** — native editor/rendering and community plugins, not a walled-off card UI.

| Traditional Anki approach | Weave Deck approach |
| --- | --- |
| Fields / forms / templates | Markdown structure + dynamic parse & preview |
| Cards often disconnected from source text | Linked files + source jump-back |
| Relatively independent app boundary | Built on Obsidian’s editor, rendering, and plugin ecosystem |
| Often a separate library and sync stack | Local Vault first |

---

### Essential experience and Premium support

The core learning loop is **free**. Premium unlocks advanced analytics, management views, emergent decks, exam banks, and more.

| Category | Capability | Essential | Premium |
| --- | --- | :---: | :---: |
| **Platform** | All platforms (Windows / macOS / Linux / iOS / Android) | ✅ | ✅ |
| **Study & cards** | **FSRS6** spaced review, deck study, undo rating, sibling dispersion | ✅ | ✅ |
| | Q&A / cloze / fill-in / multiple choice (single / multi) | ✅ | ✅ |
| | Fill-in input mode (type answers while studying, instant grading) | ✅ | ✅ |
| | Review excerpt notes and recall memory cards | ✅ | ✅ |
| | Progressive cloze | 🔒 | ✅ |
| | Image masks (image cloze and cover practice) | 🔒 | ✅ |
| **Creation & trace** | Native Obsidian card editing (Markdown / math / community renderers) | ✅ | ✅ |
| | Create cards from the active document with trace links back to source | ✅ | ✅ |
| | View source and study source info bar | ✅ | ✅ |
| | Multi-source tracing (Markdown block refs, Canvas nodes, EPUB CFI†) | ✅ | ✅ |
| **Memory decks** | Formal decks and reference-based decks (cards can belong to multiple decks) | ✅ | ✅ |
| | Independent per-deck memory config (new-card caps, queues, templates) | ✅ | ✅ |
| | Important schedule (deck-study UI; limited-time trial may apply) | 🔒 | ✅ |
| | Emergent decks (auto-clustered from tags and rules) | 🔒 | ✅ |
| | **Analytics · memory retention** | ✅ | ✅ |
| | **Analytics · deck profile, card quantity, tag difficulty, load forecast, learning calibration, review timing** | 🔒 | ✅ |
| **Exam question banks** | Question bank system and mock exams | 🔒 | ✅ |
| | Document quiz (parse questions from Markdown, run a quiz, optionally write stats back) | ✅ | ✅ |
| | **Analytics · EWMA mastery curve** (historical average, target line, confidence) | 🔒 | ✅ |
| **Management views** | Grid, masonry, Kanban, and Timeline views (full filter, group, sort) | 🔒 | ✅ |
| | Markdown deck views (`weave-decks` code block embeds) | 🔒 | ✅ |
| | Active-document filter (sidebar updates with the active note) | 🔒 | ✅ |
| | Related cards (same source / same note / relation network) | 🔒 | ✅ |
| **AI & import** | AI dialogue / card creation (bring your own API; limited-time trial may apply) | 🔒 | ✅ |
| | Parse-preview import | ✅ | ✅ |
| | Card parsing configuration (separators and regex templates for parse preview) | ✅ | ✅ |
| | CSV import | ✅ | ✅ |
| | APKG import / export (offline migration, not live sync) | ✅ | ✅ |
| | Backup and restore (vault backup slots and full-library export) | ✅ | ✅ |
| **Public API** | `getOfficialAPI()` (WeaveDomainAPI for third-party Obsidian plugins) | ✅ | ✅ |
| | Memory cards: `createCard`, bulk `importCards`, update / delete, list / query | ✅ | ✅ |
| | Memory decks: `createDeck`, find / list / update / delete | ✅ | ✅ |
| | Bulk `moveCards`, content-only `updateCardContent` (keeps FSRS progress) | ✅ | ✅ |
| | Exam banks: `createQuestionBank`, `addCardsToQuestionBank`, bulk `importExamQuestions` | 🔒 | ✅ |
| | Capability probe `getInfo()` (`apiVersion` and `capabilities`) | ✅ | ✅ |
| **Reading workflow** | Incremental reading workflow entry (Weave family; optional standalone plugin) | 🔒 | ✅ |

> Legend: ✅ included · 🔒 requires Premium support

- **Enable Premium support**: activate in Weave Deck settings. Buy-once via [Website · Pricing](https://obsidian-weave.xyz/#pricing) (series code unlocks all three plugins’ Premium). Some features may offer limited-time trials.

---

### Core features

#### Study and card types

FSRS6 spaced review, deck study, Q&A / cloze / fill-in / choice, and fill-in input mode. Progressive cloze and image masks require Premium.

See: [Card types](https://obsidian-weave.xyz/tutorials.html#card-types) · [Study session](https://obsidian-weave.xyz/tutorials.html#study-session).

#### Creation and trace

Create cards from the active document with source links; view source while studying. Multi-source tracing covers Markdown block refs, Canvas nodes, and EPUB CFI (with Weave EPUB Reader).

See: [Create card](https://obsidian-weave.xyz/tutorials.html#create-card).

#### Memory decks and analytics

Formal and reference-based decks; free **memory retention** analytics. Premium adds emergent decks, important schedule, and the remaining analytics charts.

See: [Deck study UI](https://obsidian-weave.xyz/tutorials.html#deck-study-ui) · [Deck analytics](https://obsidian-weave.xyz/tutorials.html#deck-analytics).

#### Import, AI, and public API

Parse-preview, CSV, APKG, and backup/restore cover daily interchange. AI dialogue uses your API (Premium). Third-party plugins should use `getOfficialAPI()`—do not edit `.wdeck` / `.qbank` by hand.

Common API capabilities: `createCard` / `importCards`, `createDeck` / list / update / delete, `moveCards`, `updateCardContent`, exam-bank helpers, and `getInfo()` for capability probing.

---

### Installation

#### Option 1: Community plugins (recommended)

1. **Settings → Community plugins → Browse** (disable Restricted mode if needed)
2. Search for **Weave Deck**, install, and enable

#### Option 2: Manual installation

1. Copy `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/weave/`
2. Add `sql-wasm.wasm` if you need **Legacy APKG import**
3. Restart Obsidian and enable the plugin

| Item | Requirement |
|------|-------------|
| Obsidian | **≥ 1.7.0** |
| Platforms | Desktop and mobile |

---

### Quick start

1. Open the Weave Deck view and initialize the card library (`weave/memory/`, etc.)
2. Optional: configure an OpenAI-compatible API for AI card creation (Premium)
3. Excerpt from Markdown or EPUB, create memory cards, and start reviewing
4. Optional: put card management in the sidebar and enable “filter by active document”

More: [Tutorials home](https://obsidian-weave.xyz/tutorials.html#welcome).

---

### Data and privacy

**Recommended sync (in vault)**: `weave/memory/` (`.wdeck`), `weave/question-bank/` (`.qbank`), related Markdown and attachments.

**Usually local**: cache under `.obsidian/plugins/weave/`. Prefer syncing vault content across devices.

⚠️ Do not bulk-rename or delete `.wdeck` / `.qbank` files unless you understand the impact.

- Learning data **stays in your local vault** by default and is not uploaded.
- **Premium activation** may contact the license service.
- **AI** uses your own third-party API; **APKG** is offline import/export only.

---

### Weave family

Exactly three Weave plugins, composing **read → capture → schedule → review**:

| Plugin | Responsibility |
|--------|----------------|
| **Weave Deck** (this plugin) | Memory decks, card-making, FSRS review, exams |
| **Weave EPUB Reader** | In-vault multi-format reading, excerpts, book anchors |
| **Weave Incremental Reading** | Reading points, topics, calendar scheduling, resume |

| Need… | Install |
|-------|---------|
| Cards and spaced review only | This plugin |
| Book excerpts with anchors | This plugin + [Weave EPUB Reader](https://github.com/zhuzhige123/obsidian-weave-reader) |
| Reading queue / calendar | [Weave Incremental Reading](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading) |
| Full loop | All three |
| PDF / drawings / media into the same loop | Community tools such as PDF++, Excalidraw, Media Extended, Mind Map, etc. |

---

### FAQ

#### 1. How does this relate to the EPUB reader and Incremental Reading?

**Weave Deck works standalone** for Markdown cards, FSRS, and question banks. EPUB Reader adds in-book excerpts and book-anchor jumps; Incremental Reading handles reading queues and scheduling. Licensing may be shared per product rules. They are **complementary**, not hard dependencies.

#### 2. Can cards sync across platforms?

**Yes.** Decks and notes in the vault follow your Obsidian sync setup.

#### 3. Can I export or back up data?

**Yes.** Export decks as **APKG**; `.wdeck`, `.qbank`, and related Markdown also live in the vault.

#### 4. Why is Premium paid? Subscription or buy-once?

It **funds ongoing development**. The essential FSRS / Markdown / parse-preview / retention / API / APKG loop is free. Premium is **buy-once** via [Pricing](https://obsidian-weave.xyz/#pricing), not a monthly subscription.

#### 5. Which UI languages are supported?

Currently: Simplified Chinese, English, Russian, Japanese, and Korean. German, French, Spanish, and more will be added gradually.

Email: tutaoyuan8@outlook.com.

---

### More documentation

| Resource | Link |
|----------|------|
| Website / Pricing | [obsidian-weave.xyz](https://obsidian-weave.xyz/#pricing) |
| Tutorials | [tutorials.html · Weave Deck](https://obsidian-weave.xyz/tutorials.html#welcome) |
| Issues | [GitHub Issues](https://github.com/zhuzhige123/obsidian---Weave/issues) |
| License | [GPL-3.0-or-later](LICENSE) |

### License and author

Released under [GPL-3.0-or-later](LICENSE).

- Author: **Rabbit (zhuzhige)**
- GitHub: https://github.com/zhuzhige123
- Email: tutaoyuan8@outlook.com

### Development

Requires Node.js 16+ and npm:

```bash
npm install
npm run dev
npm run build
```

---

## 中文文档

### 插件概述

**Weave Deck** 把间隔复习嵌进 Obsidian 的文件世界：从笔记生成关联记忆卡片，复习时可溯源定位回原文。按约定 Markdown 书写，插件动态解析预览为不同题型，而不是传统 Anki 式字段表单。编辑与显示依托 Obsidian 自身编辑器与渲染引擎，因而能与众多社区插件协同。数据完全本地化，留在你的库里。

| 概念 | 说明 |
|------|------|
| **记忆卡片** | 以 Markdown 结构书写、可复习、并与来源关联的条目 |
| **记忆牌组（`.wdeck`）** | 卡片容器；支持正式牌组与引用式归属 |
| **溯源** | 复习时需要语境即可跳回原文位置 |

它是 **Obsidian Weave 插件系列**中的记忆插件（系列有且仅有三款：Weave Deck、Weave EPUB Reader、Weave Incremental Reading）。可单独用于 Markdown 制卡与 FSRS 复习；需要库内读书或增量阅读队列时再组合其它成员。

最低 Obsidian 版本：**1.7.0**。桌面端与移动端均可用。

完整教程见官网：[Weave Deck 教程](https://obsidian-weave.xyz/tutorials.html#welcome)。价格见 [官网 · 价格](https://obsidian-weave.xyz/#pricing)。

#### 四条原则

1. **卡片从文件中来，并与文件关联** — 复习与笔记不是两套断裂的世界。
2. **溯源** — 不仅记住答案，还能回到语境。
3. **Markdown 思维，而非表单字段思维** — 先像写笔记一样写结构，再由解析预览变成题。
4. **站在 Obsidian 生态上扩展** — 走原生编辑 / 渲染与社区插件，而不是另起围墙。

| 传统 Anki 思路 | Weave Deck 思路 |
| --- | --- |
| 字段 / 表单 / 模板 | Markdown 结构 + 动态解析预览 |
| 卡片常与原文脱节 | 关联文件 + 溯源跳转 |
| 相对独立的应用边界 | 依托 Obsidian 编辑器、渲染与插件生态 |
| 常有独立库与同步体系 | 本地 Vault 优先 |

---

### 基础体验与高级支持

核心学习闭环**免费可用**。高级支持解锁进阶分析图、管理视图、涌现牌组、考试题组等。

| 类别 | 能力 | 基础体验 | 高级支持 |
| --- | --- | :---: | :---: |
| **平台** | 全平台（Windows / macOS / Linux / iOS / Android） | ✅ | ✅ |
| **学习与卡片** | **FSRS6** 间隔复习、牌组学习、撤销评分、兄弟卡智能分散 | ✅ | ✅ |
| | 问答 / 普通挖空 / 填空题 / 选择题（单选、多选） | ✅ | ✅ |
| | 填空题输入模式（学习时输入作答、即时判分） | ✅ | ✅ |
| | 回顾型摘录笔记与回忆型记忆卡片 | ✅ | ✅ |
| | 渐进式挖空 | 🔒 | ✅ |
| | 图片遮罩（图像挖空与遮盖练习） | 🔒 | ✅ |
| **制卡与溯源** | Obsidian 原生卡片编辑（Markdown / 公式 / 社区渲染） | ✅ | ✅ |
| | 从当前活动文档制卡、带溯源链接回跳 | ✅ | ✅ |
| | 查看原文、学习来源信息栏 | ✅ | ✅ |
| | 多来源溯源（Markdown 块引用、Canvas 节点、EPUB CFI†） | ✅ | ✅ |
| **记忆牌组** | 正式牌组、引用式牌组（卡片可归属多个牌组） | ✅ | ✅ |
| | 独立牌组记忆配置（按牌组绑定新卡上限、学习队列与记忆模板） | ✅ | ✅ |
| | 重要日程（牌组学习主界面圆点切换；限时可试用） | 🔒 | ✅ |
| | 涌现牌组（按标签与规则自动聚合） | 🔒 | ✅ |
| | **分析图表 · 记忆保持率** | ✅ | ✅ |
| | **分析图表 · 牌组画像、卡片数量、标签难度、负荷预测、学习校准、复习时机** | 🔒 | ✅ |
| **考试题组** | 题库系统、模拟考试 | 🔒 | ✅ |
| | 文档测验（从 Markdown 解析题目开考，可写回统计） | ✅ | ✅ |
| | **分析图表 · EWMA 掌握度曲线**（含历史平均、目标线、置信度） | 🔒 | ✅ |
| **管理视图** | 网格视图、瀑布流布局、看板视图、时间线视图（完整筛选、分组、排序） | 🔒 | ✅ |
| | Markdown 牌组视图（`weave-decks` 代码块嵌入） | 🔒 | ✅ |
| | 当前文档筛选（侧边栏随活动笔记实时筛选） | 🔒 | ✅ |
| | 关联卡片（同源 / 同笔记 / 关联网络） | 🔒 | ✅ |
| **AI 与导入** | AI 对话（制卡分析、引用笔记/技能、预览导入；自备 API；限时可试用） | 🔒 | ✅ |
| | 解析预览导入 | ✅ | ✅ |
| | 卡片解析配置（分隔符号与正则模板，供解析预览使用） | ✅ | ✅ |
| | CSV 导入 | ✅ | ✅ |
| | APKG 导入 / 导出（离线迁移，非实时同步） | ✅ | ✅ |
| | 数据备份与恢复（Vault 备份槽、整库导出） | ✅ | ✅ |
| **公开 API** | `getOfficialAPI()`（WeaveDomainAPI，供第三方 Obsidian 插件集成） | ✅ | ✅ |
| | 记忆卡片：新建 `createCard`、批量导入 `importCards`、更新 / 删除、列出 / 查询 | ✅ | ✅ |
| | 记忆牌组：新建 `createDeck`、查找 / 列出 / 更新 / 删除 | ✅ | ✅ |
| | 批量移动 `moveCards`、只改正文 `updateCardContent`（保留 FSRS 复习进度） | ✅ | ✅ |
| | 考试题组：新建 `createQuestionBank`、引用加入 `addCardsToQuestionBank`、批量出卷 `importExamQuestions` | 🔒 | ✅ |
| | 能力探测 `getInfo()`（`apiVersion` 与 `capabilities` 字段） | ✅ | ✅ |
| **阅读工作流** | 渐进性阅读工作流入口（Weave 体系；可安装独立插件） | 🔒 | ✅ |

> 图例：✅ 已包含 · 🔒 需启用高级支持

- **启用高级支持**：在 Weave Deck 设置中激活。一次性买断见 [官网 · 价格](https://obsidian-weave.xyz/#pricing)（系列激活码可解锁三款高级支持）。部分功能可能提供限时试用。

---

### 核心功能

#### 学习与题型

FSRS6 间隔复习、牌组学习、问答 / 挖空 / 填空 / 选择，以及填空输入作答。渐进式挖空与图片遮罩属高级支持。

详见：[卡片题型](https://obsidian-weave.xyz/tutorials.html#card-types) · [记忆学习界面](https://obsidian-weave.xyz/tutorials.html#study-session)。

#### 制卡与溯源

从活动文档制卡并带溯源；学习时可查看原文。多来源溯源覆盖 Markdown 块引用、Canvas 节点与 EPUB CFI（需 Weave EPUB Reader）。

详见：[创建卡片](https://obsidian-weave.xyz/tutorials.html#create-card)。

#### 记忆牌组与分析

正式 / 引用式牌组；免费提供**记忆保持率**分析。高级支持含涌现牌组、重要日程与其余分析图表。

详见：[牌组学习界面](https://obsidian-weave.xyz/tutorials.html#deck-study-ui) · [牌组分析](https://obsidian-weave.xyz/tutorials.html#deck-analytics)。

#### 导入、AI 与公开 API

解析预览、CSV、APKG 与备份恢复覆盖日常互通。AI 对话使用你自备的 API（高级支持）。第三方插件请通过 `getOfficialAPI()` 写入——**不要**手改 `.wdeck` / `.qbank`。

常用 API：`createCard` / `importCards`，`createDeck` 及查询维护，`moveCards`，`updateCardContent`，考试题组相关接口，以及 `getInfo()` 能力探测。

---

### 安装指南

#### 方式一：社区插件（推荐）

1. 打开 **设置 → 社区插件 → 浏览**（必要时关闭「限制模式」）
2. 搜索 **Weave Deck**，安装并启用

#### 方式二：手动安装

1. 将 `main.js`、`manifest.json`、`styles.css` 复制到 `.obsidian/plugins/weave/`
2. 若需 **Legacy APKG 导入**，另附 `sql-wasm.wasm`
3. 重启 Obsidian 并启用插件

| 项目 | 要求 |
|------|------|
| Obsidian | **≥ 1.7.0** |
| 平台 | 桌面端与移动端 |

---

### 快速上手

1. 打开 Weave Deck 视图，初始化卡片库（`weave/memory/` 等）
2. 可选：配置 OpenAI 兼容 API，用于 AI 制卡（高级支持）
3. 从 Markdown 或 EPUB 摘录，创建记忆卡片并开始复习
4. 可选：把卡片管理放到侧边栏，开启「关联当前活动文档」

更多：[教程首页](https://obsidian-weave.xyz/tutorials.html#welcome)。

---

### 数据与隐私

**建议同步（Vault）**：`weave/memory/`（`.wdeck`）、`weave/question-bank/`（`.qbank`）、相关 Markdown 与附件。

**通常本地**：`.obsidian/plugins/weave/` 下的缓存。多端请优先同步 Vault。

⚠️ 除非清楚影响，请勿批量重命名或删除 `.wdeck` / `.qbank`。

- 学习数据**默认保存在本地 Vault**，不会主动上传。
- **高级支持激活**可能访问许可证服务。
- **AI** 调用你自行配置的第三方 API；**APKG** 仅用于离线导入 / 导出。

---

### 与 Weave 系列

系列共三款插件，围绕 **读 → 记 → 排 → 复习**：

| 插件 | 职责 |
|------|------|
| **Weave Deck**（本插件） | 记忆牌组、制卡、FSRS 复习、考试 |
| **Weave EPUB Reader** | 库内多格式阅读、摘录、书籍锚点 |
| **Weave Incremental Reading** | 阅读点、专题、日历调度、续读 |

| 需要… | 安装 |
|-------|------|
| 仅制卡与间隔复习 | 本插件 |
| 书中摘录与锚点回跳 | 本插件 + [Weave EPUB Reader](https://github.com/zhuzhige123/obsidian-weave-reader) |
| 阅读队列 / 日历 | [Weave Incremental Reading](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading) |
| 完整闭环 | 三款都装 |
| PDF / 绘图 / 媒体接入同一闭环 | PDF++、Excalidraw、Media Extended、Mind Map 等社区插件 |

---

### 常见问题

#### 1. 与 EPUB 阅读器、增量阅读的关系？

**Weave Deck 可独立使用**。EPUB Reader 负责书中摘录与锚点跳回；Incremental Reading 负责阅读队列与排期。授权可按产品规则联动。三者**分工协作**，不是硬依赖。

#### 2. 卡片能否全平台同步？

**支持。** 牌组与笔记在 Vault 内，随你的 Obsidian 同步方案跨端。

#### 3. 是否支持导出 / 备份？

**支持。** 可导出 **APKG**；`.wdeck`、`.qbank` 及关联 Markdown 均在库内。

#### 4. 为何付费？订阅还是买断？

用于**持续开发**。基础 FSRS / Markdown / 解析预览 / 保持率 / API / APKG 闭环免费。高级支持为**买断制**，见 [价格](https://obsidian-weave.xyz/#pricing)，非按月订阅。

#### 5. 目前支持哪些界面语言？

当前：简体中文、英文、俄语、日语、韩语。德语、法语、西班牙语等将逐步补充。

邮箱：tutaoyuan8@outlook.com。

---

### 更多文档

| 资源 | 链接 |
|------|------|
| 官网 / 价格 | [obsidian-weave.xyz](https://obsidian-weave.xyz/#pricing) |
| 使用教程 | [tutorials.html · Weave Deck](https://obsidian-weave.xyz/tutorials.html#welcome) |
| Issues | [GitHub Issues](https://github.com/zhuzhige123/obsidian---Weave/issues) |
| 许可证 | [GPL-3.0-or-later](LICENSE) |

### 许可证与作者

源码基于 [GPL-3.0-or-later](LICENSE) 发布。

- 作者：**Rabbit (zhuzhige)**
- GitHub：https://github.com/zhuzhige123
- 邮箱：tutaoyuan8@outlook.com

### 开发

环境要求：Node.js 16+、npm

```bash
npm install
npm run dev
npm run build
```
