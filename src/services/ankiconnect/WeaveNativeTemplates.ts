/**
 * Weave 插件原生模板定义
 * 用于导出到 Anki 的专用模板，不依赖于导入的模板
 */

/**
 * 原生模板定义接口
 */
export interface WeaveNativeTemplate {
  id: string;
  name: string;
  displayName: string;
  cardType: 'qa' | 'choice' | 'cloze';
  fields: string[];
  frontTemplate: string;
  backTemplate: string;
  css: string;
}

/**
 * Weave 原生模板列表
 */
export const WEAVE_NATIVE_TEMPLATES: WeaveNativeTemplate[] = [
  // 问答题模板
  {
    id: 'weave-native-qa',
    name: '【Weave】问答题',
    displayName: 'Weave 问答题',
    cardType: 'qa',
    fields: [
      'front',
      'back',
      'hint',
      'explanation',
      'weave_template_id',
      'weave_card_id',
      'source',
      'tags'
    ],
    frontTemplate: `<div class="weave-card">
  <div class="card-content">
    {{front}}
  </div>
  {{#hint}}
  <div class="hint-section">
    <div class="hint-label">💡 提示</div>
    <div class="hint-content">{{hint}}</div>
  </div>
  {{/hint}}
</div>`,
    backTemplate: `<div class="weave-card">
  <div class="card-content question">
    {{front}}
  </div>
  
  <hr class="divider">
  
  <div class="card-content answer">
    {{back}}
  </div>
  
  {{#explanation}}
  <div class="explanation-section">
    <div class="explanation-label">📖 解析</div>
    <div class="explanation-content">{{explanation}}</div>
  </div>
  {{/explanation}}
  
  {{#source}}
  <div class="source-section">
    {{source}}
  </div>
  {{/source}}
</div>`,
    css: `/* Weave 问答题样式 */
.weave-card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 18px;
  line-height: 1.6;
  color: #2c3e50;
  padding: 20px;
}

.card-content {
  margin-bottom: 16px;
}

.card-content.question {
  font-size: 20px;
  font-weight: 500;
  color: #34495e;
}

.card-content.answer {
  font-size: 18px;
  color: #2c3e50;
}

.divider {
  border: none;
  border-top: 2px solid #e0e0e0;
  margin: 20px 0;
}

.hint-section {
  background: linear-gradient(135deg, #FFF9C4 0%, #FFF59D 100%);
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 16px;
  border-left: 4px solid #FBC02D;
}

.hint-label {
  font-size: 14px;
  font-weight: 600;
  color: #F57F17;
  margin-bottom: 6px;
}

.hint-content {
  font-size: 16px;
  color: #5D4037;
}

.explanation-section {
  background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%);
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 16px;
  border-left: 4px solid #1976D2;
}

.explanation-label {
  font-size: 14px;
  font-weight: 600;
  color: #0D47A1;
  margin-bottom: 6px;
}

.explanation-content {
  font-size: 16px;
  color: #37474F;
}

.source-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 8px 0;
}

code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace;
  font-size: 0.9em;
}

pre {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
}

pre code {
  background: transparent;
  padding: 0;
}`
  },

  // 选择题模板
  {
    id: 'weave-native-choice',
    name: '【Weave】选择题',
    displayName: 'Weave 选择题',
    cardType: 'choice',
    fields: [
      'front',
      'options',
      'back',
      'explanation',
      'weave_template_id',
      'weave_card_id',
      'source',
      'tags'
    ],
    frontTemplate: `<div class="weave-card choice-card">
  <div class="question-section">
    {{front}}
  </div>
  
  <div class="options-section">
    {{options}}
  </div>
</div>`,
    backTemplate: `<div class="weave-card choice-card">
  <div class="question-section">
    {{front}}
  </div>
  
  <div class="options-section">
    {{options}}
  </div>
  
  <hr class="divider">
  
  <div class="answer-section">
    <div class="answer-label">✓ 答案</div>
    <div class="answer-content">{{back}}</div>
  </div>
  
  {{#explanation}}
  <div class="explanation-section">
    <div class="explanation-label">📖 解析</div>
    <div class="explanation-content">{{explanation}}</div>
  </div>
  {{/explanation}}
  
  {{#source}}
  <div class="source-section">
    {{source}}
  </div>
  {{/source}}
</div>`,
    css: `/* Weave 选择题样式 */
.weave-card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 18px;
  line-height: 1.6;
  color: #2c3e50;
  padding: 20px;
}

.choice-card .question-section {
  font-size: 19px;
  font-weight: 500;
  color: #34495e;
  margin-bottom: 20px;
}

.options-section {
  margin: 16px 0;
}

.choice-option {
  background: #f8f9fa;
  padding: 12px 16px;
  margin: 8px 0;
  border-radius: 8px;
  border-left: 4px solid #dee2e6;
  transition: all 0.2s ease;
}

.choice-option:hover {
  background: #e9ecef;
  border-left-color: #adb5bd;
}

.choice-option.correct {
  background: linear-gradient(135deg, #D4EDDA 0%, #C3E6CB 100%);
  border-left-color: #28A745;
}

.choice-option.incorrect {
  background: linear-gradient(135deg, #F8D7DA 0%, #F5C6CB 100%);
  border-left-color: #DC3545;
}

.divider {
  border: none;
  border-top: 2px solid #e0e0e0;
  margin: 20px 0;
}

.answer-section {
  background: linear-gradient(135deg, #D4EDDA 0%, #C3E6CB 100%);
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 16px;
  border-left: 4px solid #28A745;
}

.answer-label {
  font-size: 14px;
  font-weight: 600;
  color: #155724;
  margin-bottom: 6px;
}

.answer-content {
  font-size: 17px;
  color: #1E4620;
  font-weight: 500;
}

.explanation-section {
  background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%);
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 16px;
  border-left: 4px solid #1976D2;
}

.explanation-label {
  font-size: 14px;
  font-weight: 600;
  color: #0D47A1;
  margin-bottom: 6px;
}

.explanation-content {
  font-size: 16px;
  color: #37474F;
}

.source-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 8px 0;
}`
  },

  // 填空题模板
  {
    id: 'weave-native-cloze',
    name: '【Weave】填空题',
    displayName: 'Weave 填空题',
    cardType: 'cloze',
    fields: [
      'text',
      'hint',
      'explanation',
      'weave_template_id',
      'weave_card_id',
      'source',
      'tags'
    ],
    frontTemplate: `<div class="weave-card cloze-card">
  <div class="cloze-content">
    {{cloze:text}}
  </div>
  
  {{#hint}}
  <div class="hint-section">
    <div class="hint-label">💡 提示</div>
    <div class="hint-content">{{hint}}</div>
  </div>
  {{/hint}}
</div>`,
    backTemplate: `<div class="weave-card cloze-card">
  <div class="cloze-content">
    {{cloze:text}}
  </div>
  
  {{#explanation}}
  <div class="explanation-section">
    <div class="explanation-label">📖 解析</div>
    <div class="explanation-content">{{explanation}}</div>
  </div>
  {{/explanation}}
  
  {{#source}}
  <div class="source-section">
    {{source}}
  </div>
  {{/source}}
</div>`,
    css: `/* Weave 填空题样式 */
.weave-card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 18px;
  line-height: 1.8;
  color: #2c3e50;
  padding: 20px;
}

.cloze-card .cloze-content {
  font-size: 19px;
  color: #34495e;
  min-height: 60px;
}

.cloze {
  background: linear-gradient(135deg, #FFF9C4 0%, #FFF59D 100%);
  color: #F57F17;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  border-bottom: 2px solid #FBC02D;
}

.hint-section {
  background: linear-gradient(135deg, #E1F5FE 0%, #B3E5FC 100%);
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 16px;
  border-left: 4px solid #039BE5;
}

.hint-label {
  font-size: 14px;
  font-weight: 600;
  color: #01579B;
  margin-bottom: 6px;
}

.hint-content {
  font-size: 16px;
  color: #263238;
}

.explanation-section {
  background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%);
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 16px;
  border-left: 4px solid #1976D2;
}

.explanation-label {
  font-size: 14px;
  font-weight: 600;
  color: #0D47A1;
  margin-bottom: 6px;
}

.explanation-content {
  font-size: 16px;
  color: #37474F;
}

.source-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 8px 0;
}`
  }
];

/**
 * 根据卡片类型获取原生模板
 */
export function getNativeTemplateByCardType(cardType: string): WeaveNativeTemplate | null {
  const normalizedType = cardType.toLowerCase();
  
  // 问答题映射
  if (['basic-qa', 'qa', 'basic', 'basic-reverse'].includes(normalizedType)) {
    return WEAVE_NATIVE_TEMPLATES.find(t => t.id === 'weave-native-qa') || null;
  }
  
  // 选择题映射
  if (['single-choice', 'multiple-choice', 'choice'].includes(normalizedType)) {
    return WEAVE_NATIVE_TEMPLATES.find(t => t.id === 'weave-native-choice') || null;
  }
  
  // 填空题映射
  if (['cloze-deletion', 'cloze'].includes(normalizedType)) {
    return WEAVE_NATIVE_TEMPLATES.find(t => t.id === 'weave-native-cloze') || null;
  }
  
  // 默认返回问答题
  return WEAVE_NATIVE_TEMPLATES.find(t => t.id === 'weave-native-qa') || null;
}

/**
 * 根据 ID 获取原生模板
 */
export function getNativeTemplateById(id: string): WeaveNativeTemplate | null {
  return WEAVE_NATIVE_TEMPLATES.find(t => t.id === id) || null;
}
