/**
 * 内置牌组标签组模板
 * 
 * 提供常用领域的标签组模板，方便用户快速上手
 */

import type { DeckTagGroup } from '../types/deck-kanban-types';

/**
 * 内置标签组模板
 */
export const DEFAULT_TAG_GROUP_TEMPLATES: DeckTagGroup[] = [
  // ==================== 医学领域 ====================
  {
    id: 'medical-circulatory',
    name: '循环系统',
    tags: ['心功能不全', '心力衰竭', '高血压', '冠心病', '心律失常'],
    icon: '🫀',
    color: '#ef4444',
    description: '循环系统相关疾病的学习卡片'
  },
  {
    id: 'medical-respiratory',
    name: '呼吸系统',
    tags: ['哮喘', '肺炎', 'COPD', '肺结核', '肺癌'],
    icon: '🫁',
    color: '#3b82f6',
    description: '呼吸系统相关疾病的学习卡片'
  },
  {
    id: 'medical-digestive',
    name: '消化系统',
    tags: ['胃炎', '肝炎', '胰腺炎', '肠炎', '消化性溃疡'],
    icon: '🦠',
    color: '#f59e0b',
    description: '消化系统相关疾病的学习卡片'
  },
  {
    id: 'medical-nervous',
    name: '神经系统',
    tags: ['脑卒中', '癫痫', '帕金森', '阿尔茨海默', '脑炎'],
    icon: '🧠',
    color: '#8b5cf6',
    description: '神经系统相关疾病的学习卡片'
  },

  // ==================== 编程领域 ====================
  {
    id: 'programming-frontend',
    name: '前端开发',
    tags: ['HTML', 'CSS', 'JavaScript', 'React', 'Vue', 'TypeScript'],
    icon: '🎨',
    color: '#10b981',
    description: '前端技术栈学习'
  },
  {
    id: 'programming-backend',
    name: '后端开发',
    tags: ['Node.js', 'Python', 'Java', 'Go', 'SQL', 'Redis'],
    icon: '⚙️',
    color: '#6366f1',
    description: '后端技术栈学习'
  },
  {
    id: 'programming-algorithm',
    name: '算法数据结构',
    tags: ['数组', '链表', '树', '图', '动态规划', '贪心算法'],
    icon: '🔢',
    color: '#ec4899',
    description: '算法和数据结构学习'
  },
  {
    id: 'programming-devops',
    name: 'DevOps运维',
    tags: ['Docker', 'Kubernetes', 'CI/CD', 'Linux', 'Nginx', '监控'],
    icon: '🐳',
    color: '#14b8a6',
    description: 'DevOps和运维技术'
  },

  // ==================== 语言学习 ====================
  {
    id: 'language-english-grammar',
    name: '英语语法',
    tags: ['时态', '语态', '从句', '虚拟语气', '非谓语动词'],
    icon: '📖',
    color: '#f59e0b',
    description: '英语语法知识点'
  },
  {
    id: 'language-english-vocabulary',
    name: '英语词汇',
    tags: ['四级词汇', '六级词汇', '托福词汇', '雅思词汇', '商务英语'],
    icon: '📚',
    color: '#3b82f6',
    description: '英语词汇学习'
  },
  {
    id: 'language-japanese',
    name: '日语学习',
    tags: ['平假名', '片假名', 'N5', 'N4', 'N3', 'N2', 'N1'],
    icon: '🇯🇵',
    color: '#ef4444',
    description: '日语学习'
  },

  // ==================== 考试备考 ====================
  {
    id: 'exam-gaokao',
    name: '高考科目',
    tags: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'],
    icon: '🎓',
    color: '#ef4444',
    description: '高考科目学习'
  },
  {
    id: 'exam-postgraduate',
    name: '考研科目',
    tags: ['政治', '英语一', '英语二', '数学一', '数学二', '数学三', '专业课'],
    icon: '📝',
    color: '#8b5cf6',
    description: '考研科目学习'
  },
  {
    id: 'exam-professional',
    name: '职业资格考试',
    tags: ['会计', '律师', '医师', '教师', '建造师', '注册会计师'],
    icon: '💼',
    color: '#10b981',
    description: '职业资格考试备考'
  },

  // ==================== 其他领域 ====================
  {
    id: 'finance-investment',
    name: '金融投资',
    tags: ['股票', '基金', '债券', '期货', '外汇', '加密货币'],
    icon: '💰',
    color: '#f59e0b',
    description: '金融投资知识'
  },
  {
    id: 'personal-development',
    name: '个人成长',
    tags: ['时间管理', '效率工具', '沟通技巧', '心理学', '思维模型'],
    icon: '🌱',
    color: '#10b981',
    description: '个人成长与自我提升'
  },
  {
    id: 'hobby-interests',
    name: '兴趣爱好',
    tags: ['摄影', '绘画', '音乐', '运动', '烹饪', '园艺'],
    icon: '🎭',
    color: '#ec4899',
    description: '兴趣爱好相关知识'
  }
];

/**
 * 按分类组织的标签组
 */
export const TAG_GROUP_CATEGORIES = {
  medical: {
    name: '医学',
    icon: '⚕️',
    groups: [
      'medical-circulatory',
      'medical-respiratory',
      'medical-digestive',
      'medical-nervous'
    ]
  },
  programming: {
    name: '编程',
    icon: '💻',
    groups: [
      'programming-frontend',
      'programming-backend',
      'programming-algorithm',
      'programming-devops'
    ]
  },
  language: {
    name: '语言',
    icon: '🌐',
    groups: [
      'language-english-grammar',
      'language-english-vocabulary',
      'language-japanese'
    ]
  },
  exam: {
    name: '考试',
    icon: '📋',
    groups: [
      'exam-gaokao',
      'exam-postgraduate',
      'exam-professional'
    ]
  },
  other: {
    name: '其他',
    icon: '✨',
    groups: [
      'finance-investment',
      'personal-development',
      'hobby-interests'
    ]
  }
};
