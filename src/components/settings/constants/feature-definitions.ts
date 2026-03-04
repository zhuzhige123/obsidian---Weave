import { logger } from '../../../utils/logger';
/**
 * 功能定义配置文件
 * 统一管理所有功能的定义、状态和展示信息
 */

export interface FeatureItem {
  id: string;
  name: string;
  description?: string;
  status: 'stable' | 'beta' | 'development' | 'planned';
  category: 'basic' | 'premium';
  icon?: string;
  estimatedDate?: string;
  version?: string;
}

export interface FeatureCategory {
  id: 'basic' | 'premium';
  title: string;
  subtitle?: string;
  icon: string;
  description: string;
  features: FeatureItem[];
}

// 功能状态配置
export const FEATURE_STATUS_CONFIG = {
  stable: {
    icon: '[OK]',
    label: '已完成',
    color: '#10b981', // green-500
    bgColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.2)'
  },
  beta: {
    icon: '[BETA]',
    label: '测试版',
    color: '#3b82f6', // blue-500
    bgColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.2)'
  },
  development: {
    icon: '[DEV]',
    label: '开发中',
    color: '#f59e0b', // amber-500
    bgColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.2)'
  },
  planned: {
    icon: '[PLAN]',
    label: '计划中',
    color: '#6b7280', // gray-500
    bgColor: 'rgba(107, 114, 128, 0.1)',
    borderColor: 'rgba(107, 114, 128, 0.2)'
  }
} as const;

// 基础功能列表
export const BASIC_FEATURES: FeatureItem[] = [
  {
    id: 'regular-card-creation',
    name: '常规制卡',
    status: 'stable',
    category: 'basic',
    description: '创建和编辑基础记忆卡片，支持正反面内容',
    version: '1.0.0'
  },
  {
    id: 'fsrs6-algorithm',
    name: 'FSRS6算法',
    status: 'stable',
    category: 'basic',
    description: '基于最新FSRS6算法的智能间隔重复调度',
    version: '1.0.0'
  },
  {
    id: 'card-table-management',
    name: '卡片表格视图管理',
    status: 'stable',
    category: 'basic',
    description: '表格形式管理所有卡片，支持筛选和排序',
    version: '1.0.0'
  },
  {
    id: 'data-management',
    name: '数据管理',
    status: 'stable',
    category: 'basic',
    description: '数据导入导出和备份，确保数据安全',
    version: '1.0.0'
  },
  {
    id: 'anki-one-way-sync',
    name: 'Anki单向同步',
    status: 'stable',
    category: 'basic',
    description: '从Anki导入卡片数据，保持学习连续性',
    version: '1.0.0'
  },
  {
    id: 'apkg-import',
    name: 'apkg导入',
    status: 'stable',
    category: 'basic',
    description: '导入Anki包文件，快速迁移学习内容',
    version: '1.0.0'
  }
];

// 高级功能列表
export const PREMIUM_FEATURES: FeatureItem[] = [
  {
    id: 'batch-card-creation',
    name: '批量制卡',
    status: 'development',
    category: 'premium',
    description: '批量创建卡片，提高制卡效率',
    estimatedDate: '2025-02'
  },
  {
    id: 'ai-card-generation',
    name: 'AI制卡',
    status: 'planned',
    category: 'premium',
    description: '使用AI技术自动生成高质量卡片',
    estimatedDate: '2025-06'
  },
  {
    id: 'luhmann-card-system',
    name: '卢曼卡片ID系统',
    status: 'beta',
    category: 'premium',
    description: '构建知识网络，支持卡片间的关联',
    version: '0.8.0'
  },
  {
    id: 'anki-bidirectional-sync',
    name: 'Anki双向同步',
    status: 'planned',
    category: 'premium',
    description: '与Anki实现完整的双向数据同步',
    estimatedDate: '2025-04'
  },
  {
    id: 'deck-analytics',
    name: '牌组分析',
    status: 'stable',
    category: 'premium',
    description: '详细的牌组学习数据分析、记忆曲线和负荷预测'
  }
];

// 功能管理工具类
export class FeatureManager {
  private static instance: FeatureManager;
  private features: Map<string, FeatureItem> = new Map();

  private constructor() {
    this.loadFeatures();
  }

  static getInstance(): FeatureManager {
    if (!FeatureManager.instance) {
      FeatureManager.instance = new FeatureManager();
    }
    return FeatureManager.instance;
  }

  private loadFeatures() {
    [...BASIC_FEATURES, ...PREMIUM_FEATURES].forEach(_feature => {
      this.features.set(_feature.id, _feature);
    });
  }

  getFeaturesByCategory(category: 'basic' | 'premium'): FeatureItem[] {
    return Array.from(this.features.values())
      .filter(feature => feature.category === category)
      .sort((a, b) => this.getStatusPriority(a.status) - this.getStatusPriority(b.status));
  }

  getFeature(id: string): FeatureItem | undefined {
    return this.features.get(id);
  }

  updateFeatureStatus(featureId: string, status: FeatureItem['status']) {
    const feature = this.features.get(featureId);
    if (feature) {
      feature.status = status;
      this.notifyStatusChange(featureId, status);
    }
  }

  private getStatusPriority(status: string): number {
    const priorities = { stable: 0, beta: 1, development: 2, planned: 3 };
    return priorities[status as keyof typeof priorities] || 999;
  }

  private notifyStatusChange(featureId: string, status: FeatureItem['status']) {
    // 可以在这里添加状态变更通知逻辑
    logger.debug(`Feature ${featureId} status changed to ${status}`);
  }
}

// 工具函数
export function getStatusConfig(status: FeatureItem['status']) {
  return FEATURE_STATUS_CONFIG[status];
}

export function getFeaturesByCategory(category: 'basic' | 'premium'): FeatureItem[] {
  return FeatureManager.getInstance().getFeaturesByCategory(category);
}

export function getCategoryConfig(categoryId: 'basic' | 'premium'): FeatureCategory {
  return FEATURE_CATEGORIES.find(cat => cat.id === categoryId)!;
}

// 功能分类配置
export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: 'basic',
    title: '基础功能',
    subtitle: '核心学习功能，完全免费',
    icon: '[FREE]',
    description: '提供完整的间隔重复学习体验，满足大多数用户的学习需求',
    features: BASIC_FEATURES
  },
  {
    id: 'premium',
    title: '高级功能',
    subtitle: '专业功能，需要许可证',
    icon: '[PRO]',
    description: '为专业用户提供更强大的功能和更高效的学习工具',
    features: PREMIUM_FEATURES
  }
];
