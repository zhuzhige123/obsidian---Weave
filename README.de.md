# Weave Deck

[English](README.md#english-documentation) | [简体中文](README.md#中文文档) | [Русский](README.ru.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md)

![weave-series-banner-trinity](https://github.com/user-attachments/assets/8f748341-bb83-4cf9-b020-d8cd18a2aa92)

![weave-plugin-banner-deck](https://github.com/user-attachments/assets/2bd06511-2e12-4719-a4ae-64e590040986)

![weave-plugin-banner-deck](https://github.com/user-attachments/assets/767fd9be-6a9f-454b-8109-55a0b8c1adec)

![QQ20260915-040906-HD](https://github.com/user-attachments/assets/500543b4-f7c8-4cdb-a3f1-d551ff16559f)

![QQ20260915-042426-HD](https://github.com/user-attachments/assets/69004ae6-dd88-447c-ba46-c4dbe73660b7)

![QQ20260915-041103-HD](https://github.com/user-attachments/assets/37f11676-119c-4549-b731-6a356d3ce815)

![QQ20260915-041759-HD](https://github.com/user-attachments/assets/4ee38da8-c6f6-42b5-af7c-3992577cfca4)

**Schließen Sie in Obsidian den Lernzyklus ab: Auszug → Karten → Wiederholung → Test → Rückverfolgung**

---

## Deutsch

### Plugin-Einführung

Die Obsidian-Weave-Plugin-Serie umfasst **genau drei** Plugins: Weave Deck, Weave EPUB Reader und Weave Incremental Reading — und nur diese. Die Serie ist vollständig für Obsidian konzipiert und für langfristiges Lernen in Obsidian entwickelt worden.

Mindestversion Obsidian: **1.7.0**

### Grundlegende Nutzung und Premium-Unterstützung

| Kategorie | Funktion | Grundlegende Nutzung | Premium-Unterstützung |
| --- | --- | --- | --- |
| **Plattform** | Alle Plattformen (Windows / macOS / Linux / iOS / Android) | ✅ | ✅ |
| **Lernen & Karten** | **FSRS6**-Intervallwiederholung, Deck-Lernen, Bewertung rückgängig, intelligente Geschwisterkarten-Streuung | ✅ | ✅ |
| | Frage-Antwort / normale Lückentexte / Ausfüllen / Multiple Choice (Einzel- / Mehrfachauswahl) | ✅ | ✅ |
| | Ausfüllmodus (Antworten beim Lernen eingeben, sofortige Bewertung) | ✅ | ✅ |
| | Wiederholungs-Auszugsnotizen und Abruf-Gedächtniskarten | ✅ | ✅ |
| | Progressive Lückentexte | 🔒 | ✅ |
| | Bildmasken (Bild-Lückentexte und Abdeckungsübungen) | 🔒 | ✅ |
| **Erstellung & Rückverfolgung** | Native Obsidian-Kartenbearbeitung (Markdown / Formeln / Community-Renderer) | ✅ | ✅ |
| | Karten aus dem aktiven Dokument erstellen, mit Rückverfolgungslinks zur Quelle | ✅ | ✅ |
| | Quelle anzeigen, Informationsleiste zur Lernquelle | ✅ | ✅ |
| | Mehrquellen-Rückverfolgung (Markdown-Blockreferenzen, Canvas-Knoten, EPUB CFI†) | ✅ | ✅ |
| **Gedächtnisdecks** | Formale Decks und referenzbasierte Decks (Karten können mehreren Decks angehören) | ✅ | ✅ |
| | Emergente Decks (automatische Aggregation nach Tags und Regeln) | 🔒 | ✅ |
| | Deck-Gedächtnisrate-Badges, Deck-Hintergrundbilder | 🔒 | ✅ |
| | **Analysediagramme · Gedächtniserhalt** | ✅ | ✅ |
| | **Analysediagramme · Deck-Profil, Kartenanzahl, Tag-Schwierigkeit, Lastprognose, Lernkalibrierung, Wiederholungszeitpunkt** | 🔒 | ✅ |
| **Prüfungsfragenbanken** | Fragenbanksystem und Probeklausuren | 🔒 | ✅ |
| | Dokument-Quiz (Fragen aus Markdown parsen, Quiz starten, optional Statistiken zurückschreiben) | ✅ | ✅ |
| | **Analysediagramme · EWMA-Beherrschungskurve** (historischer Durchschnitt, Ziellinie, Konfidenz) | 🔒 | ✅ |
| **Verwaltungsansichten** | Raster-, Masonry-, Kanban- und Timeline-Ansichten (voller Filter, Gruppierung, Sortierung) | 🔒 | ✅ |
| | Markdown-Deck-Ansichten (Einbettung über `weave-decks`-Codeblock) | 🔒 | ✅ |
| | Filter nach aktivem Dokument (Seitenleiste folgt der aktiven Notiz) | 🔒 | ✅ |
| | Verwandte Karten (gleiche Quelle / gleiche Notiz / Beziehungsnetzwerk) | 🔒 | ✅ |
| **KI & Import** | KI-Kartenerstellung, KI-Assistent (eigene API, Kosten selbst tragen) | ✅ | ✅ |
| | Import mit Parse-Vorschau | ✅ | ✅ |
| | Karten-Parsing-Konfiguration (Trennzeichen und Regex-Vorlagen für Parse-Vorschau) | 🔒 | ✅ |
| | CSV-Import | ✅ | ✅ |
| | APKG-Import / -Export (Offline-Migration, keine Echtzeit-Synchronisation) | ✅ | ✅ |
| | Datensicherung und Wiederherstellung (Vault-Backup-Slots, Gesamtbibliothek-Export) | ✅ | ✅ |
| **Öffentliche API** | `getOfficialAPI()` (WeaveDomainAPI für Drittanbieter-Obsidian-Plugins) | ✅ | ✅ |
| | Gedächtniskarten: `createCard` neu, `importCards` Massenimport, Aktualisieren / Löschen, Auflisten / Abfragen | ✅ | ✅ |
| | Gedächtnisdecks: `createDeck` neu, Suchen / Auflisten / Aktualisieren / Löschen | ✅ | ✅ |
| | Massenverschiebung `moveCards`, nur Inhalt `updateCardContent` (FSRS-Fortschritt beibehalten) | ✅ | ✅ |
| | Prüfungsfragenbanken: `createQuestionBank`, `addCardsToQuestionBank`, Massenimport `importExamQuestions` | 🔒 | ✅ |
| | Fähigkeitsabfrage `getInfo()` (Felder `apiVersion` und `capabilities`) | ✅ | ✅ |
| **Lese-Workflow** | Einstieg in den inkrementellen Lese-Workflow (Weave-Ökosystem; optional als eigenständiges Plugin) | 🔒 | ✅ |

### Öffentliche API (Drittanbieter-Integration)

Weave stellt anderen Obsidian-Plugins **WeaveDomainAPI** über `app.plugins.plugins["weave"].getOfficialAPI()` zur Verfügung. Schreiben Sie Karten und Decks über die API — **bearbeiten Sie nicht** direkt `.wdeck`- / `.qbank`-Dateien im Vault.

Häufig genutzte Funktionen:

- **Gedächtniskarten**: `createCard` für eine einzelne Karte; `importCards` für Massenimport (unterstützt `ensureDeck` zum automatischen Anlegen, optionales Überspringen von Duplikaten)
- **Gedächtnisdecks**: `createDeck` zum Anlegen; `listDecks` / `findDeck` zum Abfragen; `updateDeck` / `deleteDeck` zur Pflege
- **Massenoperationen**: `moveCards` zum Verschieben (Wiederholungsfortschritt bleibt erhalten); `deleteCards` zum Löschen; `updateCardContent` nur für Inhaltsänderungen
- **Prüfungsfragenbanken**: `createQuestionBank` zum Anlegen; `addCardsToQuestionBank` zum Referenzieren vorhandener Karten; `importExamQuestions` zum Massenschreiben in Gedächtnisdecks und Anbinden an die Fragenbank (ideal für KI-generierte Prüfungen)
- **Vor der Integration**: `getInfo()` liefert `apiVersion` und `capabilities` — nehmen Sie keine unveröffentlichten Felder an

Integrationshinweise finden Sie in der Entwicklungsdokumentation `docs/WEAVE_OFFICIAL_API_GUIDE.md` (Typenquelle: `src/services/weave-domain/types.ts`).

### Ökosystem-Zusammenarbeit (optional)

Neben den Deck-Funktionen in der Tabelle können Sie Lese- und Kartenerstellungsquellen mit anderen Plugins der Serie und Community-Tools erweitern.


| Plugin / Funktion | Rolle |
| --- | --- |
| [Weave EPUB Reader](https://github.com/zhuzhige123/obsidian-weave-reader) | Immersives Lesen, Auszüge, Karten mit Buchanker-Rücksprung |
| Inkrementelles Lesen (Weave-Ökosystem) | Lesewarteschlange und Kapitelplanung |
| PDF++, Excalidraw, Media Extended, Mind Map usw. | PDFs, Zeichnungen, Video-Zeitstempel und Mindmaps in denselben Wiederholungszyklus einbinden |

### Installation

#### Option 1: Community-Plugins (empfohlen)

1. **Einstellungen → Community-Plugins → Durchsuchen** öffnen (ggf. „Eingeschränkter Modus“ deaktivieren)
2. Nach **Weave Deck** suchen, installieren und aktivieren

#### Option 2: Manuelle Installation

1. `main.js`, `manifest.json` und `styles.css` nach `.obsidian/plugins/weave/` kopieren
2. Bei Bedarf für **Legacy-APKG-Import** zusätzlich `sql-wasm.wasm` beilegen
3. Obsidian neu starten und das Plugin aktivieren

### Schnellstart

1. Weave-Deck-Ansicht in der Seitenleiste öffnen und die Kartenbibliothek initialisieren (`weave/memory/` usw.)
2. Optional: OpenAI-kompatible API für KI-Kartenerstellung konfigurieren
3. Aus Markdown oder EPUB auszugweise Karten erstellen und mit der Wiederholung beginnen
4. Optional: Kartenverwaltung in die Seitenleiste legen und „Mit aktivem Dokument verknüpfen“ aktivieren, um beim Schreiben gespeicherte Karten zu sehen

### Daten & Synchronisation

**Empfohlen zu synchronisieren (im Vault)**: `weave/memory/` (`.wdeck`), `weave/question-bank/` (`.qbank`), zugehörige Markdown-Dateien und Anhänge.

**In der Regel geräteübergreifend nicht nötig**: Cache und lokaler Zustand unter `.obsidian/plugins/weave/`. Für Lernen auf mehreren Geräten Vault-Inhalte synchronisieren.

⚠️ Benennen oder löschen Sie `.wdeck`- / `.qbank`-Dateien nicht in großer Zahl, sofern Sie die Auswirkungen nicht kennen.

### Datenschutz & Netzwerk

- Lerndaten werden **standardmäßig lokal im Vault** gespeichert; Bibliotheksinhalte werden nicht automatisch hochgeladen.
- **Premium-Aktivierung** kann den Lizenzdienst kontaktieren; Details siehe Datenschutzhinweise im Repository.
- **KI-Funktionen** nutzen Ihre selbst konfigurierte Drittanbieter-API; **APKG** dient dem Offline-Import alter Kartenpakete / Deck-Export — ohne dauerhafte Anki-Verbindung auf dem Gerät.

### Häufige Fragen

#### 1. Wie hängt das mit EPUB-Reader und inkrementellem Lesen zusammen?

**Weave funktioniert eigenständig**: Karten in Markdown, FSRS-Wiederholung, Fragenbanken usw. erfordern keine weiteren Plugins. Mit dem [Weave EPUB Reader](https://github.com/zhuzhige123/obsidian-weave-reader) können Sie im Buch auszugweise arbeiten, Karten erstellen und per Buchanker zur Quelle zurückspringen; inkrementelles Lesen kümmert sich um Lesewarteschlange und Kapitelplanung. Premium-Lizenz des Readers kann nach Produktregeln mit Weave verknüpft sein. Alle drei **ergänzen sich** — installieren Sie nach Bedarf.

#### 2. Lassen sich Karten und Auszüge plattformübergreifend synchronisieren?

**Ja.** Kartenbibliothek und zugehörige Notizen liegen im Vault und bleiben über Obsidian Sync, iCloud, Cloud-Speicher usw. auf Desktop und Mobilgerät konsistent (siehe [Daten & Synchronisation](#daten--synchronisation)).

#### 3. Kann ich Daten exportieren oder sichern?

**Ja.** Decks als **APKG** exportieren; `.wdeck`, `.qbank` und zugehöriges Markdown liegen ebenfalls in der Bibliothek — manuell kopieren oder über die Plugin-Datenverwaltung sichern. **Daten bleiben vollständig lokal**; die Backup-Strategie liegt bei Ihnen.

#### 4. Warum gibt es Premium-Unterstützung?

Sie **finanziert die laufende Entwicklung**, damit das Team langfristig Wiederholungs- und Prüfungsdetails verfeinern kann. Die **grundlegende Nutzung ist kostenlos** und deckt FSRS-Wiederholung, mehrere Kartentypen, Rückverfolgung, KI-Kartenerstellung (eigene API), Dokument-Quiz, Gedächtniserhalt-Analysen für Gedächtnisdecks, öffentliche API zum Anlegen/Importieren, APKG-Austausch und den Kern-Lernzyklus ab. Weitere Gedächtnisdeck-Analysen, Raster- / Masonry- / Kanban- / Timeline-Ansichten, emergente Decks, Prüfungsfragenbanken und deren Analysen, Markdown-Einbettungen, progressive Lückentexte usw. können bei Bedarf per Premium freigeschaltet werden.

#### 5. Abo oder Einmalkauf?

**Einmalkauf** (einmalige Aktivierung, langfristige Nutzung) — kein monatliches Abo.

#### 6. Welche UI-Sprachen werden unterstützt?

**Weave hat viele Module und umfangreiche UI-Texte** — vollständige Lokalisierung erfordert kontinuierliche Arbeit. **Derzeit verfügbar**: Vereinfachtes Chinesisch, Englisch, Russisch, Japanisch und Koreanisch; **Deutsch, Französisch, Spanisch und weitere folgen schrittweise**. Vielen Dank für Ihr Verständnis.

### Lizenz & Autor

Quellcode unter [GPL-3.0-or-later](LICENSE) veröffentlicht.

- **Issues**: [GitHub Issues](https://github.com/zhuzhige123/obsidian---Weave/issues)
- **Lizenzanfragen**: [tutaoyuan8@outlook.com](mailto:tutaoyuan8@outlook.com)

### Entwicklung

Voraussetzungen: Node.js 16+, npm

```bash
npm install
npm run dev
npm run build
```
