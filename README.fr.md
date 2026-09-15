# Weave Deck

[English](README.md#english-documentation) | [简体中文](README.md#中文文档) | [Русский](README.ru.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md)

![weave-series-banner-trinity](https://github.com/user-attachments/assets/8f748341-bb83-4cf9-b020-d8cd18a2aa92)

![weave-plugin-banner-deck](https://github.com/user-attachments/assets/2bd06511-2e12-4719-a4ae-64e590040986)

![weave-plugin-banner-deck](https://github.com/user-attachments/assets/767fd9be-6a9f-454b-8109-55a0b8c1adec)

![QQ20260915-040906-HD](https://github.com/user-attachments/assets/500543b4-f7c8-4cdb-a3f1-d551ff16559f)

![QQ20260915-042426-HD](https://github.com/user-attachments/assets/69004ae6-dd88-447c-ba46-c4dbe73660b7)

![QQ20260915-041103-HD](https://github.com/user-attachments/assets/37f11676-119c-4549-b731-6a356d3ce815)

![QQ20260915-041759-HD](https://github.com/user-attachments/assets/4ee38da8-c6f6-42b5-af7c-3992577cfca4)

**Boucle d'apprentissage complète dans Obsidian : Extrait → Cartes → Révision → Test → Traçabilité**

---

## Documentation en français

### Présentation du plugin

La série de plugins Obsidian Weave comprend **exactement trois** plugins : Weave Deck, Weave EPUB Reader et Weave Incremental Reading — et rien d'autre. La série est entièrement conçue pour Obsidian et pensée pour l'apprentissage à long terme dans Obsidian.

Version minimale d'Obsidian : **1.7.0**

### Expérience de base et support Premium

| Catégorie | Fonctionnalité | Expérience de base | Support Premium |
| --- | --- | --- | --- |
| **Plateforme** | Toutes les plateformes (Windows / macOS / Linux / iOS / Android) | ✅ | ✅ |
| **Apprentissage & cartes** | Révision espacée **FSRS6**, étude par deck, annulation de note, dispersion intelligente des cartes sœurs | ✅ | ✅ |
| | Q&R / texte à trous classique / remplissage / choix multiples (unique / multiple) | ✅ | ✅ |
| | Mode saisie pour remplissage (saisir les réponses pendant l'étude, notation instantanée) | ✅ | ✅ |
| | Notes d'extrait pour révision et cartes mémoire de rappel | ✅ | ✅ |
| | Texte à trous progressif | 🔒 | ✅ |
| | Masques d'image (texte à trous sur image et exercices de couverture) | 🔒 | ✅ |
| **Création & traçabilité** | Édition native de cartes Obsidian (Markdown / formules / renderers communautaires) | ✅ | ✅ |
| | Créer des cartes depuis le document actif avec liens de traçabilité vers la source | ✅ | ✅ |
| | Voir la source, barre d'information sur la source d'étude | ✅ | ✅ |
| | Traçabilité multi-sources (références de blocs Markdown, nœuds Canvas, EPUB CFI†) | ✅ | ✅ |
| **Decks mémoire** | Decks formels et decks par référence (une carte peut appartenir à plusieurs decks) | ✅ | ✅ |
| | Decks émergents (agrégation automatique par tags et règles) | 🔒 | ✅ |
| | Badges de taux de mémorisation, images de fond de deck | 🔒 | ✅ |
| | **Graphiques d'analyse · rétention mémorielle** | ✅ | ✅ |
| | **Graphiques d'analyse · profil de deck, nombre de cartes, difficulté des tags, prévision de charge, calibration d'apprentissage, timing de révision** | 🔒 | ✅ |
| **Banques de questions d'examen** | Système de banques de questions, examens blancs | 🔒 | ✅ |
| | Quiz documentaire (parser les questions depuis Markdown, lancer un quiz, écrire les stats en option) | ✅ | ✅ |
| | **Graphiques d'analyse · courbe de maîtrise EWMA** (moyenne historique, ligne cible, confiance) | 🔒 | ✅ |
| **Vues de gestion** | Vues Grille, Masonry, Kanban et Timeline (filtre, regroupement, tri complets) | 🔒 | ✅ |
| | Vues de deck Markdown (intégration par bloc de code `weave-decks`) | 🔒 | ✅ |
| | Filtre par document actif (barre latérale synchronisée avec la note active) | 🔒 | ✅ |
| | Cartes associées (même source / même note / réseau de relations) | 🔒 | ✅ |
| **IA & import** | Création de cartes par IA, assistant IA (API personnelle, frais à votre charge) | ✅ | ✅ |
| | Import avec aperçu de parsing | ✅ | ✅ |
| | Configuration du parsing de cartes (séparateurs et modèles regex pour l'aperçu) | 🔒 | ✅ |
| | Import CSV | ✅ | ✅ |
| | Import / export APKG (migration hors ligne, pas de sync en temps réel) | ✅ | ✅ |
| | Sauvegarde et restauration (emplacements de backup Vault, export de bibliothèque complète) | ✅ | ✅ |
| **API publique** | `getOfficialAPI()` (WeaveDomainAPI pour l'intégration de plugins Obsidian tiers) | ✅ | ✅ |
| | Cartes mémoire : `createCard` création, `importCards` import en masse, mise à jour / suppression, lister / requêter | ✅ | ✅ |
| | Decks mémoire : `createDeck` création, rechercher / lister / mettre à jour / supprimer | ✅ | ✅ |
| | Déplacement en masse `moveCards`, contenu seul `updateCardContent` (conserve la progression FSRS) | ✅ | ✅ |
| | Banques d'examen : `createQuestionBank`, `addCardsToQuestionBank`, import en masse `importExamQuestions` | 🔒 | ✅ |
| | Sonde de capacités `getInfo()` (champs `apiVersion` et `capabilities`) | ✅ | ✅ |
| **Flux de lecture** | Point d'entrée du flux de lecture incrémentale (écosystème Weave ; plugin autonome optionnel) | 🔒 | ✅ |

### API publique (intégration tierce)

Weave expose **WeaveDomainAPI** aux autres plugins Obsidian via `app.plugins.plugins["weave"].getOfficialAPI()`. Écrivez cartes et decks via l'API — **ne modifiez pas** directement les fichiers `.wdeck` / `.qbank` dans le vault.

Capacités courantes :

- **Cartes mémoire** : `createCard` pour une carte ; `importCards` pour l'import en masse (support de `ensureDeck` pour création automatique, saut des doublons en option)
- **Decks mémoire** : `createDeck` pour créer ; `listDecks` / `findDeck` pour interroger ; `updateDeck` / `deleteDeck` pour maintenir
- **Opérations en masse** : `moveCards` (conserve la progression de révision) ; `deleteCards` ; `updateCardContent` pour modifier le contenu uniquement
- **Banques de questions d'examen** : `createQuestionBank` ; `addCardsToQuestionBank` pour référencer des cartes existantes ; `importExamQuestions` pour écrire en masse dans les decks mémoire et les rattacher à la banque (idéal pour les examens générés par IA)
- **Avant d'intégrer** : `getInfo()` renvoie `apiVersion` et `capabilities` — ne présumez pas de champs non publiés

Voir la documentation de développement `docs/WEAVE_OFFICIAL_API_GUIDE.md` (source des types : `src/services/weave-domain/types.ts`).

### Écosystème (optionnel)

Au-delà des capacités Deck listées ci-dessus, vous pouvez étendre les sources de lecture et de création de cartes avec d'autres plugins de la série et des outils communautaires.


| Plugin / capacité | Rôle |
| --- | --- |
| [Weave EPUB Reader](https://github.com/zhuzhige123/obsidian-weave-reader) | Lecture immersive, extraits, retour par ancrage livre |
| Lecture incrémentale (écosystème Weave) | File de lecture et planification des chapitres |
| PDF++, Excalidraw, Media Extended, Mind Map, etc. | Intégrer PDF, dessins, horodatages vidéo et cartes mentales dans la même boucle de révision |

### Installation

#### Option 1 : Plugins communautaires (recommandé)

1. Ouvrir **Paramètres → Plugins communautaires → Parcourir** (désactiver le mode restreint si nécessaire)
2. Rechercher **Weave Deck**, installer et activer

#### Option 2 : Installation manuelle

1. Copier `main.js`, `manifest.json` et `styles.css` vers `.obsidian/plugins/weave/`
2. Ajouter `sql-wasm.wasm` si vous avez besoin de l'**import APKG Legacy**
3. Redémarrer Obsidian et activer le plugin

### Démarrage rapide

1. Ouvrir la vue Weave Deck depuis la barre latérale et initialiser la bibliothèque de cartes (`weave/memory/`, etc.)
2. Optionnel : configurer une API compatible OpenAI pour la création de cartes par IA
3. Extraire depuis Markdown ou EPUB, créer des cartes mémoire et commencer la révision
4. Optionnel : placer la gestion des cartes dans la barre latérale et activer « Lier au document actif » pour voir les cartes accumulées pendant la rédaction

### Données & synchronisation

**Recommandé à synchroniser (dans le vault)** : `weave/memory/` (`.wdeck`), `weave/question-bank/` (`.qbank`), Markdown et pièces jointes associés.

**En général sans sync inter-appareils** : cache et état local sous `.obsidian/plugins/weave/`. Pour apprendre sur plusieurs appareils, synchronisez d'abord le contenu du vault.

⚠️ Ne renommez ni ne supprimez en masse les fichiers `.wdeck` / `.qbank` sauf si vous en comprenez l'impact.

### Confidentialité & réseau

- Les données d'apprentissage **restent par défaut dans le vault local** ; le contenu de la bibliothèque n'est pas téléversé automatiquement.
- **L'activation Premium** peut contacter le service de licence ; voir les notes de confidentialité du dépôt.
- **Les fonctions IA** appellent votre API tierce configurée ; **APKG** sert à l'import hors ligne d'anciens paquets / export de decks — sans connexion Anki permanente sur la machine.

### FAQ

#### 1. Quel lien avec le lecteur EPUB et la lecture incrémentale ?

**Weave fonctionne seul** : cartes en Markdown, révision FSRS, banques de questions, etc. sans obligation d'installer d'autres plugins. Avec le [Weave EPUB Reader](https://github.com/zhuzhige123/obsidian-weave-reader), vous pouvez extraire dans les livres, créer des cartes et revenir à la source via des ancrages ; la lecture incrémentale gère la file de lecture et la planification des chapitres. Le Premium du lecteur peut être lié à Weave selon les règles produit. Les trois **se complètent** — installez selon vos besoins.

#### 2. Les cartes et extraits se synchronisent-ils sur toutes les plateformes ?

**Oui.** La bibliothèque de cartes et les notes associées sont dans le vault et restent cohérentes entre bureau et mobile via Obsidian Sync, iCloud, stockage cloud, etc. (voir [Données & synchronisation](#données--synchronisation)).

#### 3. Puis-je exporter / sauvegarder mes données ?

**Oui.** Exporter les decks en **APKG** ; `.wdeck`, `.qbank` et le Markdown associé sont aussi dans la bibliothèque — copie manuelle ou backup via la gestion des données du plugin. **Les données restent entièrement locales** ; la stratégie de sauvegarde vous appartient.

#### 4. Pourquoi un support Premium ?

Il **finance le développement continu** pour que l'équipe puisse affiner révision et évaluation sur le long terme. L'**expérience de base est gratuite** : révision FSRS, types de cartes multiples, traçabilité, création par IA (votre API), quiz documentaire, analyse de rétention des decks mémoire, API publique création/import en masse, échange APKG et boucle d'apprentissage essentielle. Activez Premium pour le reste : graphiques d'analyse des decks mémoire, vues Grille / Masonry / Kanban / Timeline, decks émergents, banques d'examen et leurs analyses, intégrations Markdown, texte à trous progressif, etc.

#### 5. Abonnement ou achat unique ?

**Achat unique** (activation une fois, utilisation à long terme) — pas d'abonnement mensuel.

#### 6. Quelles langues d'interface sont prises en charge ?

**Weave compte de nombreux modules et une interface volumineuse** — une localisation complète demande un effort continu. **Disponibles actuellement** : chinois simplifié, anglais, russe, japonais et coréen ; **allemand, français, espagnol et autres suivront progressivement**. Merci de votre compréhension.

### Licence & auteur

Code source publié sous [GPL-3.0-or-later](LICENSE).

- **Issues** : [GitHub Issues](https://github.com/zhuzhige123/obsidian---Weave/issues)
- **Licence** : [tutaoyuan8@outlook.com](mailto:tutaoyuan8@outlook.com)

### Développement

Prérequis : Node.js 16+, npm

```bash
npm install
npm run dev
npm run build
```
