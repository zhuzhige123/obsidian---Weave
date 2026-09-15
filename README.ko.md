# Weave Deck

[English](README.md#english-documentation) | [简体中文](README.md#中文文档) | [Русский](README.ru.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md)

![weave-series-banner-trinity](https://github.com/user-attachments/assets/8f748341-bb83-4cf9-b020-d8cd18a2aa92)

![weave-plugin-banner-deck](https://github.com/user-attachments/assets/2bd06511-2e12-4719-a4ae-64e590040986)

![weave-plugin-banner-deck](https://github.com/user-attachments/assets/767fd9be-6a9f-454b-8109-55a0b8c1adec)

![QQ20260915-040906-HD](https://github.com/user-attachments/assets/500543b4-f7c8-4cdb-a3f1-d551ff16559f)

![QQ20260915-042426-HD](https://github.com/user-attachments/assets/69004ae6-dd88-447c-ba46-c4dbe73660b7)

![QQ20260915-041103-HD](https://github.com/user-attachments/assets/37f11676-119c-4549-b731-6a356d3ce815)

![QQ20260915-041759-HD](https://github.com/user-attachments/assets/4ee38da8-c6f6-42b5-af7c-3992577cfca4)

**Obsidian에서 「발췌 → 카드 생성 → 복습 → 테스트 → 추적」 학습 루프 완성**

---

## 한국어 문서

### 플러그인 소개

Obsidian Weave 플러그인 시리즈에는 Weave Deck, Weave EPUB Reader, Weave Incremental Reading **세 가지뿐** 포함됩니다. 이 시리즈는 Obsidian 전용으로, Obsidian 내 장기 학습을 위해 탄생했습니다.

최소 Obsidian 버전: **1.7.0**

### 기본 체험과 프리미엄 지원

| 카테고리 | 기능 | 기본 체험 | 프리미엄 지원 |
| --- | --- | --- | --- |
| **플랫폼** | 전 플랫폼 (Windows / macOS / Linux / iOS / Android) | ✅ | ✅ |
| **학습과 카드** | **FSRS6** 간격 복습, 덱 학습, 평가 취소, 형제 카드 스마트 분산 | ✅ | ✅ |
| | Q&A / 일반 빈칸 / 채우기 / 객관식 (단일·복수) | ✅ | ✅ |
| | 채우기 입력 모드 (학습 중 입력·즉시 채점) | ✅ | ✅ |
| | 복습형 발췌 노트와 회상형 기억 카드 | ✅ | ✅ |
| | 점진적 빈칸 | 🔒 | ✅ |
| | 이미지 마스크 (이미지 빈칸과 가리기 연습) | 🔒 | ✅ |
| **카드 생성과 추적** | Obsidian 네이티브 카드 편집 (Markdown / 수식 / 커뮤니티 렌더러) | ✅ | ✅ |
| | 현재 활성 문서에서 카드 생성, 추적 링크로 원문 복귀 | ✅ | ✅ |
| | 원문 보기, 학습 출처 정보 바 | ✅ | ✅ |
| | 다중 출처 추적 (Markdown 블록 참조, Canvas 노드, EPUB CFI†) | ✅ | ✅ |
| **기억 덱** | 정식 덱, 참조형 덱 (카드가 여러 덱에 소속 가능) | ✅ | ✅ |
| | 이머전트 덱 (태그와 규칙으로 자동 집계) | 🔒 | ✅ |
| | 덱 기억률 배지, 덱 배경 이미지 | 🔒 | ✅ |
| | **분석 차트 · 기억 유지율** | ✅ | ✅ |
| | **분석 차트 · 덱 프로필, 카드 수, 태그 난이도, 부하 예측, 학습 보정, 복습 타이밍** | 🔒 | ✅ |
| **시험 문제 뱅크** | 문제 뱅크 시스템, 모의 시험 | 🔒 | ✅ |
| | 문서 퀴즈 (Markdown에서 문제 파싱 후 시험, 통계 기록 가능) | ✅ | ✅ |
| | **분석 차트 · EWMA 숙련도 곡선** (과거 평균, 목표선, 신뢰도) | 🔒 | ✅ |
| **관리 뷰** | 그리드, masonry, Kanban, 타임라인 뷰 (전체 필터·그룹·정렬) | 🔒 | ✅ |
| | Markdown 덱 뷰 (`weave-decks` 코드 블록 임베드) | 🔒 | ✅ |
| | 현재 문서 필터 (사이드바가 활성 노트에 실시간 연동) | 🔒 | ✅ |
| | 연관 카드 (동일 출처 / 동일 노트 / 연관 네트워크) | 🔒 | ✅ |
| **AI 및 가져오기** | AI 카드 생성, AI 스마트 어시스턴트 (자체 API, 비용 자부담) | ✅ | ✅ |
| | 파싱 미리보기 가져오기 | ✅ | ✅ |
| | 카드 파싱 설정 (구분 기호와 정규식 템플릿, 파싱 미리보기용) | 🔒 | ✅ |
| | CSV 가져오기 | ✅ | ✅ |
| | APKG 가져오기 / 내보내기 (오프라인 이전, 실시간 동기화 아님) | ✅ | ✅ |
| | 데이터 백업 및 복원 (Vault 백업 슬롯, 전체 라이브러리 내보내기) | ✅ | ✅ |
| **공개 API** | `getOfficialAPI()` (WeaveDomainAPI, 서드파티 Obsidian 플러그인 연동) | ✅ | ✅ |
| | 기억 카드: `createCard` 신규, `importCards` 일괄 가져오기, 업데이트 / 삭제, 목록 / 조회 | ✅ | ✅ |
| | 기억 덱: `createDeck` 신규, 검색 / 목록 / 업데이트 / 삭제 | ✅ | ✅ |
| | 일괄 `moveCards`, 본문만 `updateCardContent` (FSRS 복습 진행 유지) | ✅ | ✅ |
| | 시험 문제 뱅크: `createQuestionBank`, `addCardsToQuestionBank`, 일괄 `importExamQuestions` | 🔒 | ✅ |
| | 기능 탐지 `getInfo()` (`apiVersion` 및 `capabilities` 필드) | ✅ | ✅ |
| **독서 워크플로** | 점진적 독서 워크플로 진입점 (Weave 체계; 독립 플러그인 설치 가능) | 🔒 | ✅ |

### 공개 API (서드파티 연동)

Weave는 다른 Obsidian 플러그인에 **WeaveDomainAPI**를 `app.plugins.plugins["weave"].getOfficialAPI()`로 공개합니다. API를 통해 카드와 덱을 기록하세요 — Vault 내 `.wdeck` / `.qbank` 파일을 **직접** 수정하지 마세요.

주요 기능:

- **기억 카드**: `createCard`로 단일 카드 생성; `importCards`로 일괄 가져오기 (`ensureDeck` 자동 덱 생성, 중복 건너뛰기 지원)
- **기억 덱**: `createDeck`으로 생성; `listDecks` / `findDeck`으로 조회; `updateDeck` / `deleteDeck`으로 유지
- **일괄 작업**: `moveCards` (복습 진행 유지); `deleteCards`; `updateCardContent`는 본문만 수정
- **시험 문제 뱅크**: `createQuestionBank`; `addCardsToQuestionBank`로 기존 카드 참조 추가; `importExamQuestions`로 기억 덱에 일괄 기록 후 뱅크에 연결 (AI 출제에 적합)
- **연동 전 탐지**: `getInfo()`가 `apiVersion`과 `capabilities` 반환 — 미공개 필드를 가정하지 마세요

연동 설명은 개발 문서 `docs/WEAVE_OFFICIAL_API_GUIDE.md` (타입 원본: `src/services/weave-domain/types.ts`)를 참조하세요.

### 생태계 협업 (선택)

위 표의 Deck 본체 기능 외에도, 시리즈 내 다른 플러그인 및 커뮤니티 도구와 협력해 독서와 카드 생성 출처를 확장할 수 있습니다.


| 플러그인 / 기능 | 역할 |
| --- | --- |
| [Weave EPUB Reader](https://github.com/zhuzhige123/obsidian-weave-reader) | 몰입형 독서, 발췌·카드 생성, 도서 앵커로 원문 복귀 |
| 점진적 독서 (Weave 체계) | 독서 큐와 장 스케줄링 |
| PDF++, Excalidraw, Media Extended, Mind Map 등 | PDF / 그림 / 동영상 타임스탬프 / 마인드맵을 동일한 복습 루프에 연결 |

### 설치

#### 방법 1: 커뮤니티 플러그인 (권장)

1. **설정 → 커뮤니티 플러그인 → 찾아보기** 열기 (필요 시 「제한 모드」 해제)
2. **Weave Deck** 검색 후 설치 및 활성화

#### 방법 2: 수동 설치

1. `main.js`, `manifest.json`, `styles.css`를 `.obsidian/plugins/weave/`에 복사
2. **Legacy APKG import**가 필요하면 `sql-wasm.wasm`도 추가
3. Obsidian 재시작 후 플러그인 활성화

### 빠른 시작

1. 사이드바에서 Weave Deck 뷰를 열고 카드 라이브러리 초기화 (`weave/memory/` 등)
2. 선택: AI 카드 생성용 OpenAI 호환 API 구성
3. Markdown 또는 EPUB에서 발췌, 기억 카드 생성 후 복습 시작
4. 선택: 카드 관리를 사이드바에 배치하고 「현재 활성 문서 연관」을 켜서 노트 작성 중 축적된 카드 확인

### 데이터와 동기화

**동기화 권장 (Vault 내)**: `weave/memory/` (`.wdeck`), `weave/question-bank/` (`.qbank`), 관련 Markdown 및 첨부 파일.

**보통 기기 간 동기화 불필요**: `.obsidian/plugins/weave/` 아래 캐시와 로컬 상태. 다기기 학습은 Vault 내용 동기화를 우선하세요.

⚠️ 영향을 잘 모르면 `.wdeck` / `.qbank` 파일을 일괄 이름 변경하거나 삭제하지 마세요.

### 개인정보 및 네트워크

- 학습 데이터는 **기본적으로 로컬 Vault에 저장**되며, 라이브러리 내용을 능동적으로 업로드하지 않습니다.
- **프리미엄 지원 활성화**는 라이선스 서비스에 접근할 수 있습니다. 자세한 내용은 저장소 개인정보 설명을 참조하세요.
- **AI 기능**은 직접 구성한 서드파티 API를 호출합니다; **APKG**는 구 카드팩 오프라인 가져오기 / 덱 내보내기용이며, 로컬 Anki 상시 연결에 의존하지 않습니다.

### 자주 묻는 질문

#### 1. EPUB 리더, 점진적 독서와의 관계는?

**Weave는 단독 사용 가능**합니다: Markdown에서 카드 생성, FSRS 복습, 문제 뱅크 등에 다른 플러그인 설치가 필수는 아닙니다. [Weave EPUB Reader](https://github.com/zhuzhige123/obsidian-weave-reader) 설치 후 책에서 발췌·카드 생성하고 도서 앵커로 원문 복귀할 수 있습니다; 점진적 독서는 독서 큐와 장 스케줄링을 담당합니다. 리더 프리미엄 지원은 Weave 라이선스와 연동될 수 있습니다. 세 가지는 **역할 분담으로 협력**하며, 필요에 따라 설치하세요.

#### 2. 카드와 발췌가 전 플랫폼에서 동기화되나요?

**지원합니다.** 카드 라이브러리와 관련 노트는 Vault 내에 있으며, Obsidian Sync, iCloud, 클라우드 드라이브 등 Vault 동기화 방식으로 데스크톱과 모바일에서 일치합니다 ([데이터와 동기화](#데이터와-동기화) 참조).

#### 3. 데이터 내보내기 / 백업이 가능한가요?

**지원합니다.** 덱을 **APKG**로 내보낼 수 있습니다; `.wdeck`, `.qbank` 및 관련 Markdown도 라이브러리 내에 있으며, 직접 복사하거나 플러그인 데이터 관리로 백업할 수 있습니다. **데이터는 완전히 로컬**이며, 백업 전략은 사용자가 관리합니다.

#### 4. 왜 프리미엄 지원을 제공하나요?

**지속적인 개발을 지원**하여 팀이 장기적으로 복습과 테스트 세부 사항을 다듬을 수 있게 합니다. **기본 체험은 무료**이며 FSRS 복습, 다양한 카드 형태, 추적, AI 카드 생성(자체 API), 문서 퀴즈, 기억 덱 「기억 유지율」 분석, 공개 API 카드/덱 생성·일괄 가져오기, APKG 상호 운용 등 핵심 학습 루프를 포함합니다; 나머지 기억 덱 분석 차트, 그리드 / masonry / Kanban / 타임라인, 이머전트 덱, 시험 문제 뱅크 및 뱅크 분석, Markdown 임베드, 점진적 빈칸 등은 필요에 따라 프리미엄 지원을 활성화하세요.

#### 5. 구독인가요, 일회성 구매인가요?

**일회성 구매** (한 번 활성화, 장기 사용)이며, 월 구독이 아닙니다.

#### 6. 어떤 UI 언어를 사용할 수 있나요?

**Weave는 기능 모듈이 많고 UI 문구량도 큽니다** — 완전한 현지화에는 지속적인 투입이 필요합니다. **현재 이용 가능한 UI 언어**는 간체 중국어, 영어, 러시아어, 일본어, 한국어입니다; **독일어, 프랑스어, 스페인어 등은 점진적으로 추가**됩니다. 양해 부탁드립니다.

### 라이선스 및 저자

소스 코드는 [GPL-3.0-or-later](LICENSE)로 공개됩니다.

- **Issues**: [GitHub Issues](https://github.com/zhuzhige123/obsidian---Weave/issues)
- **라이선스 문의**: [tutaoyuan8@outlook.com](mailto:tutaoyuan8@outlook.com)

### 개발

환경 요구 사항: Node.js 16+, npm

```bash
npm install
npm run dev
npm run build
```
