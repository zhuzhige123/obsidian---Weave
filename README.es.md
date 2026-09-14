# Weave Deck

[简体中文](README.md#中文文档) | [English](README.md#english-documentation) | [Русский](README.ru.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md)

![weave-series-banner-trinity](https://github.com/user-attachments/assets/8f748341-bb83-4cf9-b020-d8cd18a2aa92)

![weave-plugin-banner-deck](https://github.com/user-attachments/assets/2bd06511-2e12-4719-a4ae-64e590040986)

![weave-plugin-banner-deck](https://github.com/user-attachments/assets/767fd9be-6a9f-454b-8109-55a0b8c1adec)

![QQ20260915-040906-HD](https://github.com/user-attachments/assets/500543b4-f7c8-4cdb-a3f1-d551ff16559f)

![QQ20260915-042426-HD](https://github.com/user-attachments/assets/69004ae6-dd88-447c-ba46-c4dbe73660b7)

![QQ20260915-041103-HD](https://github.com/user-attachments/assets/37f11676-119c-4549-b731-6a356d3ce815)

![QQ20260915-041759-HD](https://github.com/user-attachments/assets/4ee38da8-c6f6-42b5-af7c-3992577cfca4)

**Complete el ciclo de aprendizaje en Obsidian: Extracto → Tarjetas → Repaso → Test → Trazabilidad**

---

## Documentación en español

### Presentación del plugin

La serie de plugins Obsidian Weave incluye **exactamente tres** plugins: Weave Deck, Weave EPUB Reader y Weave Incremental Reading — y solo esos. La serie está pensada íntegramente para Obsidian y nació para el aprendizaje a largo plazo dentro de Obsidian.

Versión mínima de Obsidian: **1.7.0**

### Experiencia básica y soporte Premium

| Categoría | Capacidad | Experiencia básica | Soporte Premium |
| --- | --- | --- | --- |
| **Plataforma** | Todas las plataformas (Windows / macOS / Linux / iOS / Android) | ✅ | ✅ |
| **Estudio y tarjetas** | Repaso espaciado **FSRS6**, estudio por mazo, deshacer calificación, dispersión inteligente de tarjetas hermanas | ✅ | ✅ |
| | Pregunta-respuesta / cloze normal / relleno / opción múltiple (única / múltiple) | ✅ | ✅ |
| | Modo de entrada para relleno (escribir respuestas al estudiar, calificación instantánea) | ✅ | ✅ |
| | Notas de extracto para repaso y tarjetas de memoria de recuerdo | ✅ | ✅ |
| | Cloze progresivo | 🔒 | ✅ |
| | Máscaras de imagen (cloze en imagen y práctica con cobertura) | 🔒 | ✅ |
| **Creación y trazabilidad** | Edición nativa de tarjetas Obsidian (Markdown / fórmulas / renderizadores de la comunidad) | ✅ | ✅ |
| | Crear tarjetas desde el documento activo con enlaces de trazabilidad a la fuente | ✅ | ✅ |
| | Ver fuente, barra de información de origen al estudiar | ✅ | ✅ |
| | Trazabilidad multi-fuente (referencias de bloque Markdown, nodos Canvas, EPUB CFI†) | ✅ | ✅ |
| **Mazos de memoria** | Mazos formales y mazos por referencia (una tarjeta puede pertenecer a varios mazos) | ✅ | ✅ |
| | Mazos emergentes (agregación automática por etiquetas y reglas) | 🔒 | ✅ |
| | Insignias de tasa de memoria del mazo, imágenes de fondo del mazo | 🔒 | ✅ |
| | **Gráficos analíticos · retención de memoria** | ✅ | ✅ |
| | **Gráficos analíticos · perfil del mazo, cantidad de tarjetas, dificultad de etiquetas, previsión de carga, calibración de aprendizaje, momento de repaso** | 🔒 | ✅ |
| **Bancos de preguntas de examen** | Sistema de bancos de preguntas, exámenes simulados | 🔒 | ✅ |
| | Cuestionario de documento (analizar preguntas desde Markdown, iniciar test, opcionalmente escribir estadísticas) | ✅ | ✅ |
| | **Gráficos analíticos · curva de dominio EWMA** (media histórica, línea objetivo, confianza) | 🔒 | ✅ |
| **Vistas de gestión** | Vistas Cuadrícula, Masonry, Kanban y Timeline (filtro, agrupación y ordenación completos) | 🔒 | ✅ |
| | Vistas de mazo Markdown (incrustación con bloque de código `weave-decks`) | 🔒 | ✅ |
| | Filtro por documento activo (barra lateral sincronizada con la nota activa) | 🔒 | ✅ |
| | Tarjetas relacionadas (misma fuente / misma nota / red de relaciones) | 🔒 | ✅ |
| **IA e importación** | Creación de tarjetas con IA, asistente IA (API propia, costes a su cargo) | ✅ | ✅ |
| | Importación con vista previa de análisis | ✅ | ✅ |
| | Configuración de análisis de tarjetas (separadores y plantillas regex para vista previa) | 🔒 | ✅ |
| | Importación CSV | ✅ | ✅ |
| | Importación / exportación APKG (migración offline, no sincronización en tiempo real) | ✅ | ✅ |
| | Copia de seguridad y restauración (ranuras de backup del vault, exportación de biblioteca completa) | ✅ | ✅ |
| **API pública** | `getOfficialAPI()` (WeaveDomainAPI para integración de plugins Obsidian de terceros) | ✅ | ✅ |
| | Tarjetas de memoria: `createCard` crear, `importCards` importación masiva, actualizar / eliminar, listar / consultar | ✅ | ✅ |
| | Mazos de memoria: `createDeck` crear, buscar / listar / actualizar / eliminar | ✅ | ✅ |
| | `moveCards` masivo, solo contenido `updateCardContent` (conserva progreso FSRS) | ✅ | ✅ |
| | Bancos de examen: `createQuestionBank`, `addCardsToQuestionBank`, importación masiva `importExamQuestions` | 🔒 | ✅ |
| | Sonda de capacidades `getInfo()` (campos `apiVersion` y `capabilities`) | ✅ | ✅ |
| **Flujo de lectura** | Entrada al flujo de lectura incremental (ecosistema Weave; plugin independiente opcional) | 🔒 | ✅ |

### API pública (integración de terceros)

Weave expone **WeaveDomainAPI** a otros plugins Obsidian mediante `app.plugins.plugins["weave"].getOfficialAPI()`. Escriba tarjetas y mazos a través de la API — **no** edite directamente archivos `.wdeck` / `.qbank` en el vault.

Capacidades habituales:

- **Tarjetas de memoria**: `createCard` para una tarjeta; `importCards` para importación masiva (admite `ensureDeck` para crear mazo automáticamente, omitir duplicados opcional)
- **Mazos de memoria**: `createDeck` para crear; `listDecks` / `findDeck` para consultar; `updateDeck` / `deleteDeck` para mantener
- **Operaciones masivas**: `moveCards` (conserva progreso de repaso); `deleteCards`; `updateCardContent` solo para contenido
- **Bancos de preguntas de examen**: `createQuestionBank`; `addCardsToQuestionBank` para referenciar tarjetas existentes; `importExamQuestions` para escribir masivamente en mazos de memoria y vincular al banco (ideal para exámenes generados por IA)
- **Antes de integrar**: `getInfo()` devuelve `apiVersion` y `capabilities` — no asuma campos no publicados

Consulte la documentación de desarrollo `docs/WEAVE_OFFICIAL_API_GUIDE.md` (fuente de tipos: `src/services/weave-domain/types.ts`).

### Ecosistema (opcional)

Además de las capacidades de Deck de la tabla, puede ampliar fuentes de lectura y creación de tarjetas con otros plugins de la serie y herramientas de la comunidad.


| Plugin / capacidad | Función |
| --- | --- |
| [Weave EPUB Reader](https://github.com/zhuzhige123/obsidian-weave-reader) | Lectura inmersiva, extractos, salto de vuelta con ancla del libro |
| Lectura incremental (ecosistema Weave) | Cola de lectura y planificación de capítulos |
| PDF++, Excalidraw, Media Extended, Mind Map, etc. | Integrar PDF, dibujos, marcas de tiempo de vídeo y mapas mentales en el mismo ciclo de repaso |

### Instalación

#### Opción 1: Plugins de la comunidad (recomendado)

1. Abrir **Ajustes → Plugins de la comunidad → Explorar** (desactivar modo restringido si hace falta)
2. Buscar **Weave Deck**, instalar y activar

#### Opción 2: Instalación manual

1. Copiar `main.js`, `manifest.json` y `styles.css` a `.obsidian/plugins/weave/`
2. Añadir `sql-wasm.wasm` si necesita **importación APKG Legacy**
3. Reiniciar Obsidian y activar el plugin

### Inicio rápido

1. Abrir la vista Weave Deck desde la barra lateral e inicializar la biblioteca de tarjetas (`weave/memory/`, etc.)
2. Opcional: configurar una API compatible con OpenAI para creación de tarjetas con IA
3. Extraer desde Markdown o EPUB, crear tarjetas de memoria y empezar el repaso
4. Opcional: colocar la gestión de tarjetas en la barra lateral y activar « Vincular al documento activo » para ver tarjetas acumuladas mientras escribe

### Datos y sincronización

**Recomendado sincronizar (en el vault)**: `weave/memory/` (`.wdeck`), `weave/question-bank/` (`.qbank`), Markdown y adjuntos relacionados.

**Normalmente no hace falta entre dispositivos**: caché y estado local bajo `.obsidian/plugins/weave/`. Para estudiar en varios dispositivos, sincronice primero el contenido del vault.

⚠️ No renombre ni elimine en masa archivos `.wdeck` / `.qbank` a menos que entienda el impacto.

### Privacidad y red

- Los datos de aprendizaje **se guardan por defecto en el vault local**; el contenido de la biblioteca no se sube automáticamente.
- **La activación Premium** puede contactar el servicio de licencias; véase la política de privacidad del repositorio.
- **Las funciones de IA** usan su API de terceros configurada; **APKG** sirve para importar paquetes antiguos offline / exportar mazos — sin conexión permanente a Anki en el equipo.

### Preguntas frecuentes

#### 1. ¿Qué relación tiene con el lector EPUB y la lectura incremental?

**Weave funciona de forma independiente**: tarjetas en Markdown, repaso FSRS, bancos de preguntas, etc. sin obligación de instalar otros plugins. Con [Weave EPUB Reader](https://github.com/zhuzhige123/obsidian-weave-reader) puede extraer en libros, crear tarjetas y volver al texto con anclas del libro; la lectura incremental gestiona la cola de lectura y la planificación de capítulos. El Premium del lector puede vincularse con Weave según reglas del producto. Los tres **colaboran por roles** — instale según necesidad.

#### 2. ¿Se sincronizan tarjetas y extractos en todas las plataformas?

**Sí.** La biblioteca de tarjetas y las notas relacionadas están en el vault y se mantienen coherentes entre escritorio y móvil con Obsidian Sync, iCloud, almacenamiento en la nube, etc. (véase [Datos y sincronización](#datos-y-sincronización)).

#### 3. ¿Puedo exportar o hacer copia de seguridad?

**Sí.** Exportar mazos como **APKG**; `.wdeck`, `.qbank` y Markdown asociado también están en la biblioteca — copia manual o backup mediante la gestión de datos del plugin. **Los datos son totalmente locales**; usted controla la estrategia de respaldo.

#### 4. ¿Por qué existe el soporte Premium?

**Financia el desarrollo continuo** para que el equipo pueda pulir repaso y evaluación a largo plazo. La **experiencia básica es gratuita** e incluye repaso FSRS, múltiples tipos de tarjeta, trazabilidad, creación con IA (su API), cuestionario de documento, análisis de retención de mazos de memoria, API pública de creación/importación masiva, intercambio APKG y el ciclo de aprendizaje esencial. Active Premium para el resto: gráficos analíticos de mazos de memoria, vistas Cuadrícula / Masonry / Kanban / Timeline, mazos emergentes, bancos de examen y sus análisis, incrustaciones Markdown, cloze progresivo, etc.

#### 5. ¿Suscripción o compra única?

**Compra única** (activación una vez, uso a largo plazo) — no suscripción mensual.

#### 6. ¿Qué idiomas de interfaz están disponibles?

**Weave tiene muchos módulos y una interfaz extensa** — la localización completa requiere esfuerzo continuo. **Disponibles actualmente**: chino simplificado, inglés, ruso, japonés y coreano; **alemán, francés, español y más se irán añadiendo gradualmente**. Gracias por su comprensión.

### Licencia y autor

Código fuente publicado bajo [GPL-3.0-or-later](LICENSE).

- **Issues**: [GitHub Issues](https://github.com/zhuzhige123/obsidian---Weave/issues)
- **Licencias**: [tutaoyuan8@outlook.com](mailto:tutaoyuan8@outlook.com)

### Desarrollo

Requisitos: Node.js 16+, npm

```bash
npm install
npm run dev
npm run build
```
