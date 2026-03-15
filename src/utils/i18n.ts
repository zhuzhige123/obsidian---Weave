import { logger } from '../utils/logger';
import { vaultStorage } from '../utils/vault-local-storage';
/**
 * 国际化系统
 * 提供多语言支持和文本本地化功能
 */

import { writable, derived } from 'svelte/store';

// ============================================================================
// 类型定义
// ============================================================================

export type SupportedLanguage = 'zh-CN' | 'en-US';

export interface TranslationKey {
  [key: string]: string | string[] | TranslationKey;
}

export interface I18nConfig {
  defaultLanguage: SupportedLanguage;
  fallbackLanguage: SupportedLanguage;
  supportedLanguages: SupportedLanguage[];
}

// ============================================================================
// 翻译资源
// ============================================================================

const translations: Record<SupportedLanguage, TranslationKey> = {
  'zh-CN': {
    analytics: {
      dashboard: {
        title: '牌组分析',
        loading: '正在加载数据...',
        error: '数据加载失败',
        retry: '重试',
        refresh: '刷新',
        noData: '暂无数据',
        
        // KPI 卡片
        kpi: {
          todayReviews: '今日复习',
          todayNew: '今日新增',
          accuracy: '正确率',
          studyTime: '学习时长',
          memoryRate: '记忆率',
          streakDays: '连续天数',
          fsrsProgress: 'FSRS进度',
          
          // 趋势描述
          trend: {
            up: '上升',
            down: '下降',
            stable: '稳定',
            yesterdayCompare: '较昨日',
            newCardsAdded: '未学习加入'
          }
        },
        
        // 图表标题
        charts: {
          reviewTrend: '复习趋势（{days}天）',
          ratingDistribution: '评分分布',
          calendarHeatmap: '热力图（日历）',
          timeHeatmap: '时段热力（24h×7）',
          intervalGrowth: '间隔增长（周均 scheduledDays）',
          deckComparison: '牌组对比'
        },
        
        // 表格标题
        table: {
          deck: '牌组',
          reviews: '复习量',
          accuracy: '正确率',
          avgInterval: '平均间隔',
          avgDifficulty: '平均难度'
        },
        
        // FSRS 分析
        fsrs: {
          title: 'FSRS6 算法分析',
          avgDifficulty: '平均难度',
          avgStability: '平均稳定性',
          difficultyScore: 'FSRS难度评分',
          stabilityDays: '天数',
          retentionRate: '记忆保持率',
          learningEfficiency: '学习效率'
        }
      },
      
      // 时间范围
      timeRange: {
        last7Days: '最近7天',
        last30Days: '最近30天',
        last90Days: '最近90天',
        thisMonth: '本月',
        lastMonth: '上月',
        thisYear: '今年',
        custom: '自定义'
      },
      
      // 错误消息
      errors: {
        loadFailed: '数据加载失败',
        networkError: '网络连接错误',
        dataCorrupted: '数据损坏',
        insufficientData: '数据不足',
        calculationError: '计算错误'
      }
    },
    
    settings: {
      title: '设置',
      categories: {
        basic: '基础',
        memoryLearning: '记忆学习',
        fsrs6: 'FSRS6算法',
        cardParsing: '批量解析',
        aiConfig: 'AI服务',
        incrementalReading: '增量阅读',
        virtualization: '性能优化',
        dataManagement: '数据管理',
        ankiConnect: 'Anki同步',
        about: '关于'
      },
      basic: {
        title: '基础设置',
        language: {
          label: '语言',
          chinese: '简体中文',
          english: 'English',
          description: '选择界面显示语言'
        },
        defaultDeck: {
          label: '默认牌组',
          placeholder: '输入默认牌组名称',
          description: '未学习卡片默认添加到此牌组'
        },
        notifications: {
          label: '启用通知',
          description: '显示学习提醒和系统通知'
        },
        floatingButton: {
          label: '显示悬浮新建按钮',
          description: '在界面右下角显示快速新建按钮'
        },
        shortcuts: {
          label: '启用键盘快捷键',
          description: '学习模式的键盘快捷键（1-4评分，空格显示答案）'
        },
        debugMode: {
          label: '调试模式',
          description: '启用后将在浏览器控制台输出详细的调试日志信息',
          enabled: '调试模式已启用，控制台将输出详细日志',
          disabled: '调试模式已关闭'
        },
        showPerformanceSettings: {
          label: '性能优化界面',
          description: '显示或隐藏性能优化设置选项',
          shownMessage: '性能优化界面已显示',
          hiddenMessage: '性能优化界面已隐藏'
        },
        progressiveCloze: {
          title: '渐进式挖空',
          historyInheritance: {
            label: '历史数据继承',
            description: '当卡片转换为渐进式挖空时，如何处理原有的学习历史',
            first: '第一个子挖空继承（推荐）',
            proportional: '所有子挖空按比例继承',
            reset: '全部重置为新卡片',
            prompt: '每次提示我选择'
          },
          updateMessage: '渐进式挖空历史继承策略已更新'
        },
        deckCardStyle: {
          label: '牌组卡片设计',
          description: '选择牌组学习界面中卡片的视觉风格',
          options: {
            default: '默认样式',
            chineseElegant: '典雅风格'
          },
          updateMessage: '牌组卡片设计已更新'
        },
        premiumFeaturesPreview: {
          label: '显示高级功能预览'
        },
        mainInterfaceOpenLocation: {
          label: '主界面打开位置',
          content: '内容区（主编辑区域）',
          sidebar: '侧边栏'
        },
        studyViewSpacing: {
          label: '学习界面间距',
          compact: '紧凑',
          default: '默认',
          comfortable: '宽松'
        }
      },
      memoryLearning: {
        learningSteps: {
          label: '学习步骤（分钟）',
          helpText: '用空格分隔多个时间间隔'
        },
        graduatingInterval: {
          label: '毕业间隔（天）',
          unit: '天'
        },
        maxAdvanceDays: {
          label: '提前学习天数限制',
          unit: '天'
        }
      },
      editor: {
        title: '编辑器设置',
        description: '配置卡片编辑器和链接格式',
        editorMode: {
          label: '编辑器模式',
          markdownMode: 'Markdown 模式',
          description: '统一使用Markdown格式进行卡片编辑'
        },
        linkStyle: {
          label: '链接样式'
        },
        linkPath: {
          label: '链接路径'
        },
        preferAlias: {
          label: '优先使用别名'
        },
        attachmentDir: {
          label: '附件目录'
        },
        embedImages: {
          label: '自动嵌入图片'
        },
        linkPathDisplay: {
          short: '最短',
          relative: '相对',
          absolute: '绝对'
        },
        window: {
          title: '编辑器窗口设置',
          enableResize: {
            label: '启用拖拽调整',
            description: '允许通过拖拽边框调整编辑窗口尺寸'
          },
          windowSize: {
            label: '窗口尺寸',
            description: '选择编辑窗口的默认大小'
          },
          rememberSize: {
            label: '记住上次尺寸',
            description: '下次打开时恢复上次的窗口大小'
          },
          sizePresets: {
            small: '小',
            medium: '中',
            large: '大',
            fullscreen: '全屏',
            custom: '自定义'
          }
        }
      },
      learning: {
        title: '学习设置',
        reviewsPerDay: {
          label: '每日复习数量',
          description: '每天计划复习的卡片数量上限'
        },
        newCardsPerDay: {
          label: '每日未学习数量',
          description: '每天学习的未学习卡片数量上限'
        },
        learningSteps: {
          label: '学习步骤（分钟）',
          description: '用逗号分隔多个时间间隔',
          placeholder: '1, 10'
        },
        graduatingInterval: {
          label: '毕业间隔（天）',
          description: '卡片从学习阶段毕业后的初始复习间隔',
          placeholder: '1'
        },
        autoAdvance: {
          label: '自动前进',
          description: '评分后自动显示下一张卡片',
          delay: '延迟（秒）'
        }
      },
      siblingDispersion: {
        title: '兄弟卡片智能分散',
        saved: '兄弟卡片分散设置已保存',
        saveFailed: '保存失败，请重试',
        enabledNotice: '兄弟卡片智能分散已启用',
        resetToDefaults: '已重置为推荐配置',
        whatIs: '什么是兄弟卡片分散？',
        description: '渐进式挖空会为一张卡片创建多个子卡片（兄弟卡片）。为了避免记忆干扰，这些兄弟卡片不应在相近日期出现。',
        benefit: '启用后可提升学习效果，减少前摄干扰和倒摄干扰，符合认知科学研究和Anki最佳实践。',
        enable: {
          label: '启用智能分散',
          description: '自动管理兄弟卡片的学习日期，避免在同一学习会话或相近日期出现'
        },
        parameters: {
          title: '核心参数'
        },
        minSpacing: {
          label: '最小间隔天数',
          description: '兄弟卡片之间的最小时间间隔（推荐：5天）'
        },
        spacingPercentage: {
          label: '动态分散比例',
          description: '基于复习间隔的动态调整比例（推荐：5%）',
          hint: '实际间隔 = max(最小间隔, 复习间隔 × 此比例)'
        },
        example: {
          title: '分散效果示例'
        },
        features: {
          title: '功能开关'
        },
        filterInQueue: {
          label: '队列生成时过滤',
          description: '避免同一学习会话中出现兄弟卡片（立即生效）',
          recommendation: '强烈推荐开启'
        },
        autoAdjustAfterReview: {
          label: '复习后动态调整',
          description: '复习后自动调整冲突的兄弟卡片due日期',
          recommendation: '推荐开启，持续优化'
        },
        respectFuzzRange: {
          label: '遵守FSRS的fuzz范围',
          description: '仅在FSRS的fuzz范围内调整，不破坏最优复习间隔',
          recommendation: '必须开启，确保科学性'
        },
        resetButton: '重置为推荐配置',
        resetHint: '基于Anki社区标准和CleverDeck最佳实践',
        science: {
          title: '科学依据',
          interference: {
            title: '记忆干扰理论',
            proactive: '前摄干扰',
            proactiveDesc: '先学习的内容干扰后学习内容的记忆',
            retroactive: '倒摄干扰',
            retroactiveDesc: '后学习的内容干扰先学习内容的记忆',
            consolidation: '记忆巩固',
            consolidationDesc: '新记忆需要时间才能稳固，相似内容连续学习会降低效果'
          },
          references: {
            title: '参考标准'
          },
          benefits: {
            title: '预期效果',
            retention: '提高长期记忆率',
            interference: '减少记忆干扰',
            efficiency: '提升学习效率',
            fsrs: '完美兼容FSRS算法'
          }
        }
      },
      navigation: {
        title: '导航可见性',
        description: '控制主界面导航项的显示'
      },
      cardParsing: {
        title: '批量解析配置',
        premiumPrompt: '批量解析功能可让您一次性处理多个文件或文件夹。升级到高级版以解锁此功能。',
        regexManagement: {
          title: '正则匹配管理',
          addMapping: '添加映射',
          presets: {
            defaultMode: '默认模式（新用户）',
            qaMode: 'Q&A 模式',
            standardDivider: '标准分隔模式',
            basicMode: '初级模式',
            ankiExport: 'Anki 导出模式'
          },
          tableHeaders: {
            type: '类型',
            path: '路径',
            filePrefix: '文件前缀',
            regexPattern: '正则匹配',
            targetDeck: '目标牌组',
            subfolders: '子文件夹',
            outerCover: '外层叠盖',
            enabled: '启用',
            actions: '操作'
          },
          actions: {
            enable: '启用',
            delete: '删除',
            edit: '编辑'
          }
        },
        preset: {
          title: '编辑正则预设',
          presetName: '预设名称',
          parseMode: '解析模式',
          cardSeparation: '卡片分隔方式',
          useCustomSeparator: '使用自定义分隔符',
          useLineSeparator: '使用全行分隔',
          cardSeparator: '卡片分隔符',
          frontBackSeparator: '正反面分隔符',
          syncMethod: '同步方法',
          excludeTags: '排除标签（逗号分隔）',
          parseModeOptions: {
            divider: '分隔符模式（简易）'
          }
        },
        dividerConfig: {
          title: '批量解析排除标签',
          regex: '正面/背面分隔符',
          regexDesc: '用于分隔卡片正面和背面内容的符号（默认：---div---）',
          marker: '挖空标记',
          markerDesc: '标记挖空内容的符号（默认：==）',
          cardSeparator: '卡片分隔符',
          cardSeparatorDesc: '在批量解析中分隔不同卡片的符号（默认：<->）'
        },
        systemExcludeTags: {
          label: '文件级别排除标签',
          value: '#we_已删除, #we_deleted',
          desc: '系统自动过滤带有这些标签的卡片文件（官方设置，不可修改）'
        },
        excludeTags: {
          title: '排除标签配置',
          label: '用户自定义排除标签',
          desc: '包含这些标签的卡片将被跳过（多个标签用逗号分隔，自动识别 # 符号）',
          placeholder: 'skip'
        },
        fileMappings: {
          title: '文件夹牌组映射',
          folderDeckMapping: 'Folder-Deck Mapping',
          desc: '配置文件夹到牌组的自动映射关系',
          addMapping: '添加映射'
        }
      },
      actions: {
        save: '保存',
        saved: '设置已保存',
        saveFailed: '保存设置失败',
        reset: '重置',
        cancel: '取消',
        confirm: '确认',
        close: '关闭'
      }
    },
    
    common: {
      loading: '加载中...',
      error: '错误',
      success: '成功',
      warning: '警告',
      info: '信息',
      confirm: '确认',
      cancel: '取消',
      save: '保存',
      delete: '删除',
      confirmDelete: '确认删除',
      confirmReset: '确认重置',
      edit: '编辑',
      close: '关闭',
      retry: '重试',
      refresh: '刷新',
      reset: '重置',
      clear: '清空',
      search: '搜索',
      filter: '筛选',
      sort: '排序',
      export: '导出',
      import: '导入',
      settings: '设置',
      help: '帮助',
      about: '关于',
      notSet: '未设置',
      unknown: '未知',
      batchOperations: '批量操作',
      premiumFeature: '高级功能',
      time: {
        seconds: '{count} 秒',
        minutes: '{count} 分钟',
        hours: '{count} 小时',
        days: '{count} 天',
        manual: '手动'
      },
      timeUnits: {
        seconds: '{n} 秒',
        minutes: '{n} 分钟',
        hours: '{n} 小时',
        days: '{n} 天',
        weeks: '{n} 周',
        months: '{n} 个月',
        years: '{n} 年'
      },
      count: {
        items: '{count} 项',
        selected: '已选择 {count} 项'
      },
      validation: {
        required: '此字段为必填项',
        invalid: '输入无效'
      }
    },
    
    //  新增：主导航翻译
    navigation: {
      deckStudy: '牌组学习',
      deckStudyDesc: '浏览和学习您的牌组',
      cardManagement: '卡片管理',
      cardManagementDesc: '管理和编辑您的所有卡片',
      incrementalReading: '增量摘录',
      incrementalReadingDesc: '管理阅读材料和复习计划',
      aiAssistant: 'AI制卡',
      aiAssistantDesc: '使用AI辅助创建和优化卡片',
      switchView: '切换视图',
      createDeck: '新建牌组',
      moreActions: '更多操作',
      search: '搜索',
      searchTooltip: '搜索卡片和牌组',
      notifications: '通知',
      notificationsTooltip: '查看通知和提醒',
      settings: '设置',
      settingsTooltip: '打开设置面板'
    },
    
    //  庆祝界面
    celebration: {
      title: '恭喜！今日学习完成！',
      subtitle: '你已经完成了「{deckName}」的所有学习任务',
      stats: {
        title: '今日学习成就',
        cardsStudied: '学习卡片',
        reviewed: '复习卡片',
        timeSpent: '学习时长',
        studyTime: '学习时长',
        accuracy: '正确率',
        memoryRate: '记忆率'
      },
      footer: {
        hint: '可以继续学习其他牌组哦~',
        closeButton: '知道了',
        startPracticeButton: '开始考试'
      },
      timeFormat: {
        lessThan1Min: '< 1分钟',
        minutes: '{n}分钟',
        hoursMinutes: '{h}小时{m}分钟'
      }
    },
    
    // NoCardsAvailableModal
    noCardsModal: {
      closeAriaLabel: '关闭提示窗口',
      empty: {
        title: '该牌组还没有卡片',
        message: '开始添加卡片来构建你的知识库吧',
      },
      allLearned: {
        title: '今日学习目标已达成',
        message: '牌组「{deckName}」的所有到期卡片都已复习完毕',
      },
      noDue: {
        title: '暂无到期卡片',
        messageWithCount: '牌组中有 {count} 张卡片，但目前都还没到复习时间',
        messageDefault: '牌组中的卡片目前都还没到复习时间',
      },
      default: {
        title: '无可学习卡片',
        message: '当前牌组暂时没有需要学习的卡片',
      },
      stats: {
        title: '牌组统计',
        totalCards: '总卡片',
        learned: '已学完',
        nextDue: '最近到期',
        todayNew: '今日新卡',
        unit: '张',
        completed: '已完成',
      },
      buttons: {
        startExam: '开始考试',
        advanceStudy: '提前学习',
        viewStats: '查看统计',
      }
    },

    //  评分按钮
    rating: {
      again: '重来',
      hard: '困难',
      good: '良好',
      easy: '简单',
      show: '显示答案',
      undo: '撤销',
      seconds: '{n}秒',
      minutes: '{n}分钟',
      hours: '{n}小时',
      days: '{n}天',
      months: '{n}月',
      years: '{n}年'
    },
    
    //  通知消息
    notifications: {
      success: {
        cardSaved: '卡片已保存',
        cardDeleted: '卡片已删除',
        deckCreated: '牌组已创建',
        settingsUpdated: '设置已更新',
        syncCompleted: '同步完成',
        exportSuccess: '导出成功',
        importSuccess: '导入成功',
        backupCreated: '备份已创建',
        optimizationComplete: '参数优化完成'
      },
      error: {
        saveFailed: '保存失败',
        loadFailed: '加载失败',
        deleteFailed: '删除失败',
        syncFailed: '同步失败',
        connectionFailed: '连接失败',
        exportFailed: '导出失败',
        importFailed: '导入失败',
        validationFailed: '验证失败',
        unknownError: '发生未知错误',
        startStudy: '启动学习时出错，请重试'
      },
      warning: {
        unsavedChanges: '有未保存的更改',
        licenseExpiring: '许可证即将过期',
        licenseExpired: '许可证已过期',
        backupFailed: '备份失败',
        syncConflict: '同步冲突'
      },
      info: {
        loading: '加载中...',
        syncing: '同步中...',
        processing: '处理中...',
        generating: 'AI生成中...',
        optimizing: '优化中...'
      }
    },
    
    //  菜单和工具提示
    menus: {
      context: {
        edit: '编辑',
        delete: '删除',
        duplicate: '复制',
        copy: '复制内容',
        moveTo: '移动到',
        addTags: '添加标签',
        removeTags: '移除标签',
        suspend: '暂停',
        unsuspend: '恢复',
        bury: '埋藏',
        unbury: '取消埋藏',
        flag: '标记',
        unflag: '取消标记'
      },
      tooltips: {
        clickToEdit: '点击编辑',
        doubleClickToView: '双击查看详情',
        dragToSort: '拖拽排序',
        rightClickForMore: '右键查看更多选项'
      }
    },
    
    //  学习界面
    studyInterface: {
      showAnswer: '显示答案',
      confirmAnswer: '确认答案',
      closeStudy: '关闭学习界面',
      hint: {
        showHint: '提示',
        noHint: '此卡片没有提示',
        usesRemaining: '剩余 {n} 次',
        usedUp: '提示次数已用完',
      },
      ratings: {
        again: '重来',
        hard: '困难',
        good: '良好',
        easy: '简单'
      },
      intervals: {
        unknown: '未知',
        lessThan1Min: '< 1分钟',
        minutes: '{n}分钟',
        hours: '{n}小时',
        days: '{n}天',
        months: '{n}个月',
        years: '{n}年'
      },
      errors: {
        invalidCard: '卡片数据无效',
        invalidCardId: '卡片ID无效',
        invalidFields: '字段数据结构无效',
        renderError: '渲染错误',
        noContent: '无内容',
        processingError: '处理错误',
        defaultFieldFailed: '默认字段处理失败',
        degradedFieldFailed: '降级字段处理失败'
      },
      labels: {
        error: '错误',
        statsDetails: '统计情况详情',
        noTemplates: '未找到可用模板',
        setReminder: '设置复习提醒',
        setPriority: '设置优先级'
      },
      progress: {
        ariaLabel: '学习进度',
        newCards: '未学习 {n} 张',
        learning: '学习中 {n} 张',
        review: '待复习 {n} 张',
        mastered: '已掌握 {n} 张',
        total: '总计 {n} 张卡片'
      },
      actions: {
        return: '返回',
        regenerate: '重新生成',
        collect: '收入 ({n})',
        undo: '撤销'
      }
    },
    
    //  卡片管理页面
    cardManagement: {
      more: '更多',
      search: '搜索',
      viewModes: {
        title: '视图',
        table: '表格视图',
        grid: '网格视图',
        kanban: '看板视图'
      },
      layout: {
        title: '布局',
        fixed: '固定高度',
        waterfall: '瀑布流'
      },
      gridAttributeSelector: {
        tooltip: '卡片属性显示',
        title: '左上角显示属性',
        none: '不显示',
        uuid: '唯一标识符',
        source: '来源文档',
        priority: '优先级',
        retention: '记忆程度',
        modified: '修改时间',
        accuracy: '正确率',
        question_type: '题型',
        ir_state: '阅读状态',
        ir_priority: 'IR优先级'
      },
      density: {
        title: '密度',
        compact: '紧凑',
        comfortable: '舒适',
        spacious: '宽敞'
      },
      tools: {
        title: '工具',
        scanOrphans: '扫描孤儿卡片',
        fieldManagement: '字段管理',
        columnSettings: '列设置'
      },
      filters: {
        showAll: '显示全部',
        appliedFilters: '已应用筛选条件',
        clearAll: '清除所有筛选',
        deck: '牌组',
        priority: '优先级',
        time: '时间'
      },
      empty: {
        hint: '请添加卡片或调整筛选条件'
      },
      batchToolbar: {
        selected: '已选择 {count} 张卡片',
        copy: '复制',
        changeDeck: '更换牌组',
        changeTemplate: '更换模板（暂不可用）',
        addTags: '添加标签',
        removeTags: '删除标签',
        exportToMd: '导出为笔记',
        exportSingleFile: '导出为一个笔记',
        exportBySource: '按来源文档分别导出',
        exportSelectFolder: '选择保存位置',
        exportSuccess: '已导出 {count} 张卡片到 {path}',
        exportSuccessMultiple: '已导出 {count} 张卡片到 {fileCount} 个文件',
        exportFailed: '导出失败: {error}',
        exportNoCards: '没有可导出的卡片',
        exportFilterYaml: '过滤YAML元数据',
        exportKeepYaml: '保留YAML元数据'
      },
      batchDelete: {
        confirm: '确定要删除选中的 {count} 张卡片吗？此操作不可撤销。'
      },
      management: {
        filtered: '已筛选 {count} 张卡片',
        filterFromSource: '已筛选 {count} 张卡片 (来自: {source})',
        destroyingComponent: '组件销毁，清理资源',
        loadingCards: '开始加载卡片数据...',
        foundDecks: '找到 {count} 个牌组',
        deckCards: '牌组 "{name}": {count} 张卡片',
        totalLoaded: '总计加载 {count} 张卡片',
        migrationNeeded: '检测到 {count} 张卡片需要迁移错题集数据',
        migrationComplete: '错题集数据迁移完成',
        loadFailed: '加载卡片数据失败: {error}',
        transformingData: '重新转换卡片数据'
      }
    },
    
    //  牌组学习页面
    deckStudyPage: {
      deckTypes: {
        choice: '选择题'
      },
      urgency: {
        urgent: '紧急',
        completed: '完成'
      },
      moreActions: '更多操作',
      tableHeaders: {
        deckName: '牌组名称',
        newCards: '未学习',
        learning: '学习中',
        review: '待复习',
        actions: '操作'
      },
      import: {
        success: '导入成功！牌组: {deckName}, 导入: {count} 张卡片',
        error: '导入失败: {error}',
        failed: '导入失败'
      },
      dataChange: '牌组数据变更',
      filters: {
        memoryMode: '显示所有记忆牌组',
        readingMode: '增量摘录',
        questionBank: '题库牌组'
      },
      study: {
        targetDeckFound: '如果找到了目标牌组，开始学习',
        noDeckAvailable: '没有需要学习的卡片',
        noAdvanceCards: '暂无可提前学习的卡片'
      },
      tree: {
        firstUseExpand: '首次使用，默认展开根级牌组',
        loading: '加载牌组树...'
      },
      stats: {
        recordingInstances: '记录每个牌组的学习实例总数',
        calculatingDailyQuota: '为每个牌组计算今日已学习数量',
        loadingStats: '加载牌组统计...'
      },
      views: {
        grid: '网格卡片',
        gridDesc: '色卡风格，多彩展示',
        kanban: '看板视图',
        kanbanDesc: '按阶段组织，可视化流程'
      },
      menu: {
        importAPKG: '旧版APKG格式导入',
        importCSV: '导入CSV文件',
        importClipboard: '粘贴卡片批量导入',
        exportJSON: '导出JSON数据',
        importFolder: '导入文件夹',
        management: '操作管理',
        restoreTutorialDeck: '恢复官方教程牌组'
      },
      notices: {
        tutorialRestored: '官方教程牌组已恢复',
        tutorialRestoreFailed: '恢复教程牌组失败',
        noBlocks: '该牌组暂无内容块',
        noDueBlocks: '"{name}" 暂无到期内容块',
        startReadingFailed: '开始阅读失败',
        qbServiceNotInit: '题库服务未初始化',
        noQuestions: '该题库暂无题目',
        startExamFailed: '开始考试失败',
        deckNotFound: '牌组不存在',
        deckUpdated: '牌组已更新',
        editFailed: '编辑失败',
        exportFailed: '导出失败'
      },
      edit: {
        title: '编辑牌组',
        name: '名称',
        tag: '牌组标签(单选)',
        tagDesc: '标签用于牌组分类，仅可选择一个标签',
        tagPlaceholder: '输入标签后按回车添加',
        description: '描述',
        descPlaceholder: '可选'
      },
      fallback: {
        deck: '牌组',
        incrementalReading: '增量阅读',
        unknownBank: '未知题库'
      },
      studyActions: {
        startError: '启动学习时出错，请重试。',
        loading: '正在加载牌组数据...',
        studyButton: '学习',
        completedButton: '完成',
        advanceStudy: '提前学习',
        noAdvanceCards: '暂无可提前学习的卡片',
        advanceStudyStarted: '开始提前学习（{count} 张未到期卡片）',
        advanceStudyFailed: '启动提前学习失败',
        collapse: '折叠',
        expand: '展开'
      },
      exam: {
        missingDeckInfo: '无法开始考试：缺少牌组信息',
        qbNotEnabled: '题库功能未启用',
        noPairedBank: '暂无该记忆牌组对应的考试牌组',
        startFailed: '开始考试失败'
      },
      time: {
        tomorrow: '明天',
        hoursLater: '{hours} 小时后',
        minutesLater: '{minutes} 分钟后'
      },
      editModal: {
        deckName: '牌组名称',
        deckNameDesc: '输入牌组的显示名称',
        deckNamePlaceholder: '输入牌组名称',
        tags: '标签',
        addTag: '+ 添加',
        noTags: '暂无标签',
        tagNamePlaceholder: '输入标签名称',
        confirm: '确定',
        deckNameRequired: '牌组名称不能为空',
        updateFailed: '更新失败'
      },
      deleteModal: {
        title: '确认删除',
        confirmMessage: '确定要删除牌组"{name}"吗？',
        cardWarning: '该牌组引用了 {count} 张卡片，删除牌组将同时删除所有引用的卡片（即使被其他牌组引用）。',
        irreversible: '此操作不可撤销！',
        confirmButton: '确认删除',
        progressTitle: '删除牌组卡片',
        progressDesc: '正在删除牌组"{name}"中的 {count} 张卡片...',
        cleaningRefs: '清理其他牌组的引用...',
        refsCleaned: '引用清理完成',
        deletingCards: '删除卡片数据...',
        cardsDeleted: '卡片数据已删除',
        cleaningCache: '清理缓存...',
        cacheCleaned: '清理完成',
        deletedCount: '已删除 {count} 张卡片',
        success: '成功删除牌组"{name}"',
        successWithCards: '成功删除牌组"{name}"及其 {count} 张卡片',
        failed: '删除失败'
      },
      dissolve: {
        title: '解散牌组',
        confirmMessage: '确定要解散牌组"{name}"吗？',
        cardCount: '该牌组引用了 {count} 张卡片。',
        warning: '解散后，牌组将被删除，但卡片数据会保留。',
        confirmButton: '确认解散',
        inProgress: '正在解散牌组...',
        success: '牌组"{name}"已解散',
        orphanedCards: '，{count} 张卡片变为孤儿卡片',
        failed: '解散失败',
        serviceNotInit: '引用式牌组服务未初始化'
      },
      analyticsAction: {
        openFailed: '打开牌组分析失败'
      },
      contextMenu: {
        advanceStudy: '提前学习',
        deckAnalytics: '牌组分析',
        editDeck: '牌组编辑',
        delete: '删除',
        dissolveDeck: '解散牌组'
      },
      subdeck: {
        indicator: '包含 {total} 张子牌组卡片 (新卡: {newCards}, 学习: {learning}, 复习: {review})'
      }
    },
    
    //  筛选组件
    filters: {
      loading: '加载筛选数据...',
      sections: {
        decks: '牌组筛选',
        types: '题型筛选',
        priority: '优先级',
        tags: '标签筛选',
        time: '时间筛选'
      },
      allDecks: '全部牌组',
      noTags: '暂无标签',
      clearAll: '清除所有筛选',
      myFilters: '我的筛选',
      manage: '管理',
      cardTypes: {
        qa: '问答题',
        choice: '选择题',
        fill: '填空题',
        cloze: '挖空题'
      },
      priorities: {
        all: '全部',
        high: '高优先级',
        medium: '中优先级',
        low: '低优先级',
        none: '无优先级'
      },
      timeFilters: {
        all: '全部',
        today: '今天',
        dueToday: '今天到期',
        addedToday: '今天添加',
        editedToday: '今天编辑',
        reviewedToday: '今天复习',
        firstReview: '首次复习',
        retryToday: '今天重来',
        neverReviewed: '从未复习'
      },
      status: {
        new: '未学习',
        learning: '学习中',
        review: '复习中',
        mastered: '已掌握'
      },
      advancedBuilder: {
        title: '高级筛选构建器',
        addGroup: '添加条件组',
        addCondition: '添加条件',
        removeGroup: '删除组',
        results: '筛选结果',
        calculating: '计算中',
        cards: '张卡片',
        apply: '应用',
        save: '保存',
        cancel: '取消',
        enableCondition: '点击启用此条件',
        disableCondition: '点击禁用此条件'
      }
    },
    
    //  UI组件通用翻译
    ui: {
      cancel: '取消',
      confirm: '确认',
      delete: '删除',
      save: '保存',
      edit: '编辑',
      close: '关闭',
      closeNotification: '关闭通知',
      newCard: '新建卡片',
      progressBar: '进度条',
      hideMonitor: '隐藏监控器',
      technicalDetails: '技术详情',
      metrics: {
        memoryUsage: '内存使用',
        cacheHitRate: '缓存命中率',
        throughput: '吞吐量',
        networkLatency: '网络延迟',
        errorRate: '错误率'
      },
      pagination: {
        previous: '上一页',
        next: '下一页',
        page: '第 {n} 页',
        total: '共 {n} 张卡片'
      },
      tables: {
        loading: '加载中...',
        empty: '暂无数据',
        selectAll: '全选'
      }
    },
    
    //  表格组件
    tables: {
      card: {
        loading: '正在加载卡片...',
        empty: '暂无卡片'
      }
    },
    
    //  FSRS算法设置
    fsrs: {
      title: 'FSRS6算法设置',
      description: '配置间隔重复学习算法参数',
      savedMessage: 'FSRS6设置已保存',
      saveFailed: '保存设置失败',
      basicParams: {
        title: '基础参数',
        retention: {
          label: '目标记忆率',
          description: '期望的长期记忆保持率（0.5-0.99）'
        },
        maxInterval: {
          label: '最大间隔',
          description: '卡片复习的最大间隔天数'
        },
        enableFuzz: {
          label: '启用随机化',
          description: '在计算的间隔基础上添加随机波动'
        }
      },
      advancedSettings: {
        title: '高级设置',
        weights: {
          title: '权重参数',
          description: 'FSRS6算法的21个权重参数，影响记忆预测的准确性',
          allowEdit: '允许编辑',
          locked: '权重参数已锁定，启用"允许编辑"开关以修改参数',
          warning: '修改权重参数可能影响学习效果，请谨慎操作',
          reset: '重置默认'
        }
      },
      optimization: {
        title: '智能优化',
        description: '基于您的学习数据自动调优FSRS6参数',
        overview: {
          title: '优化概览',
          description: '点击FSRS6标准模型来优化算法性',
          algorithmVersion: '算法版本',
          systemVersion: '系统版本',
          reviewRecords: '复习记录',
          optimizationResult: '优化结果',
          consecutiveParams: '连续参数',
          dataPoints: '数据点',
          refresh: '刷新'
        },
        dataPoints: '数据点数量',
        accuracy: '预测准确性',
        status: '优化状态',
        statusReady: '就绪',
        statusOptimizing: '优化中...',
        startButton: '开始优化',
        optimizingButton: '优化中...',
        complete: '参数优化完成',
        failed: '参数优化失败'
      },
      performance: {
        title: '性能监控',
        description: '实时监控FSRS6算法的运行状态和性能指标',
        refresh: '刷新',
        algorithmVersion: '算法版本',
        executionTime: '执行时间',
        cacheHitRate: '缓存命中率',
        activeInstances: '活跃实例',
        noData: '点击刷新按钮获取性能指标'
      },
      parameters: {
        title: '算法参数',
        targetRetention: {
          label: '目标记忆率',
          description: '期望的长期记忆保持率（0.5-0.99）',
          placeholder: '例如：0.9表示90%记忆率'
        },
        maxInterval: {
          label: '最大间隔',
          description: '两次复习之间的最长天数',
          unit: '天'
        }
      },
      actions: {
        reset: '重置为默认值',
        import: '导入参数',
        export: '导出参数',
        save: '保存参数',
        cancel: '取消'
      }
    },
    
    epub: {
      export: {
        readingNotes: '阅读笔记',
        bookInfo: '书籍信息',
        author: '作者',
        publisher: '出版社',
        readingProgress: '阅读进度',
        bookmarks: '书签',
        highlights: '高亮',
        notes: '笔记',
        colorYellow: '黄色高亮',
        colorGreen: '绿色高亮',
        colorBlue: '蓝色高亮',
        colorPink: '粉色高亮',
        colorPurple: '紫色高亮'
      }
    },
    
    //  卡片解析设置
    parsing: {
      title: '卡片解析设置',
      description: '配置Markdown文件的卡片批量解析规则',
      batchParsing: {
        title: '批量解析',
        enable: {
          label: '启用批量解析',
          description: '扫描文件中的卡片标记并批量创建'
        },
        markers: {
          title: '解析标记',
          startMarker: {
            label: '开始标记',
            description: '批量解析的起始标记',
            default: '---start---'
          },
          endMarker: {
            label: '结束标记',
            description: '批量解析的结束标记',
            default: '---end---'
          }
        }
      },
      cloze: {
        title: '挖空语法',
        defaultSyntax: {
          label: '默认语法',
          markdown: 'Markdown高亮（==文本==）',
          anki: 'Anki格式（{{c1::文本}}）'
        },
        autoDetect: {
          label: '自动检测',
          description: '自动检测并支持两种语法'
        }
      }
    },
    
    //  AI制卡配置
    aiConfig: {
      title: '',
      description: '',
      providers: {
        title: 'AI提供商',
        openai: 'OpenAI',
        gemini: 'Google Gemini',
        anthropic: 'Anthropic Claude',
        deepseek: 'DeepSeek',
        zhipu: '智谱清言',
        siliconflow: '硅基流动',
        xai: 'xAI Grok',
        select: '选择提供商'
      },
      apiKeys: {
        title: 'API密钥配置',
        apiKeyLabel: 'API密钥',
        apiKeyDescription: '输入您的{provider} API密钥',
        modelLabel: '模型',
        modelDescription: '选择要使用的AI模型',
        testConnection: '测试连接',
        testing: '测试中...',
        testSuccess: '连接成功！',
        testFailed: 'API密钥未配置',
        show: '显示',
        hide: '隐藏',
        verified: '已验证',
        defaultBadge: '默认',
        formattingBadge: '格式化',
        splittingBadge: 'AI拆分',
        menuLabel: '提供商配置菜单',
        configOptions: '配置选项',
        menu: {
          customApiUrl: '自定义API地址',
          editApiUrl: '修改API地址',
          resetApiUrl: '重置为默认地址',
          addCustomModel: '新增自定义AI模型'
        },
        customModel: {
          title: '新增自定义AI模型',
          nameLabel: '模型名称',
          namePlaceholder: '例如: gpt-4o-2024-05-13',
          nameHint: '请输入模型的完整名称（如API文档中所示）',
          emptyError: '模型名称不能为空',
          invalidCharsError: '模型名称包含无效字符，只允许字母、数字、连字符、点和斜杠',
          tooLongError: '模型名称过长，最多100个字符',
          validMessage: '模型名称格式正确',
          save: '保存',
          cancel: '取消'
        }
      },
      models: {
        title: '模型选择',
        select: '选择模型',
        recommended: '推荐',
        custom: '自定义模型',
        customPlaceholder: '输入自定义模型名称 (如: gpt-4o-2024-05-13)',
        customHint: '请输入完整的模型名称，如API文档中所示',
        validationError: '模型名称格式错误',
        validationWarning: '建议使用官方模型名称格式'
      },
      promptTemplates: {
        title: '提示词模板管理',
        official: {
          title: '官方模板',
          count: '{n} 个',
          badge: '官方',
          viewDetail: '查看详情'
        },
        custom: {
          title: '自定义模板',
          count: '{n} 个',
          create: '新建模板',
          edit: '编辑',
          delete: '删除',
          deleteConfirm: '确定要删除这个模板吗？'
        },
        modal: {
          createTitle: '新建模板',
          editTitle: '编辑模板',
          name: '模板名称',
          namePlaceholder: '例如：标准问答生成',
          content: '提示词内容',
          contentHelper: '使用 {变量名} 来定义可替换的变量，例如：{count}, {difficulty}',
          contentPlaceholder: '请根据以下内容生成{count}张问答卡片...',
          detectedVariables: '检测到的变量',
          variables: '变量：',
          cancel: '取消',
          save: '保存'
        }
      },
      globalParams: {
        temperature: {
          label: 'Temperature',
          description: '控制AI响应的随机性。值越低越确定，越高越创造性。推荐范围：0.5-1.0'
        },
        maxTokens: {
          label: '最大Token数',
          description: '单次请求的最大Token数量。推荐范围：1000-4000'
        },
        requestTimeout: {
          label: '请求超时时间',
          description: 'API请求超时时间（秒）。推荐：30-60秒'
        },
        concurrentLimit: {
          label: '并发请求限制',
          description: '同时发送的最大请求数。推荐：1-5'
        }
      },
      imageGeneration: {
        defaultSyntax: {
          label: '默认图片语法',
          description: '选择插入图片时使用的默认语法格式',
          wiki: 'Wiki链接 (![[image.png]])',
          markdown: 'Markdown (![](image.png))'
        },
        attachmentDir: {
          label: '附件保存目录',
          description: 'AI生成的图片将保存到这个目录下',
          placeholder: 'attachments/ai-generated'
        },
        autoCreateSubfolders: {
          label: '自动创建子文件夹',
          description: '按日期自动创建子文件夹组织图片'
        },
        includeTimestamp: {
          label: '文件名包含时间戳',
          description: '在图片文件名中包含生成时间戳'
        },
        includeCaption: {
          label: '自动添加图片说明',
          description: '在图片下方自动添加AI生成的说明文字'
        }
      },
      notices: {
        apiUrlUpdated: '{provider} API地址已更新',
        apiUrlReset: '{provider} 已重置为默认地址',
        modelValidationFailed: '模型名称验证失败'
      },
      cardSplitting: {
        title: 'AI拆分卡片配置',
        enabled: {
          label: '启用AI拆分',
          description: '在学习界面中显示AI拆分按钮，可将复杂卡片拆分为多张子卡片'
        },
        defaultTargetCount: {
          label: '默认生成数量',
          description: '设置AI拆分时默认生成的子卡片数量（0 = 让AI自动决定，通常2-5张）'
        },
        minContentLength: {
          label: '最小内容长度',
          description: '只有内容长度达到此值的卡片才可以进行拆分（字符数）'
        },
        maxContentLength: {
          label: '最大内容长度',
          description: '超过此长度的卡片内容将被截断后再拆分（字符数）'
        },
        autoInheritTags: {
          label: '自动继承标签',
          description: '子卡片自动继承父卡片的所有标签'
        },
        autoInheritSource: {
          label: '自动继承来源信息',
          description: '子卡片自动继承父卡片的Obsidian来源文档和块链接'
        },
        requireConfirmation: {
          label: '收入前确认',
          description: '收入子卡片到牌组前需要用户确认（推荐开启）'
        },
        defaultInstruction: {
          label: '默认拆分指令（可选）',
          description: '自定义AI拆分的额外指令，例如："重点关注定义和例子"（留空则使用默认指令）',
          placeholder: '输入自定义拆分指令...',
          allowEdit: '允许编辑提示词',
          locked: '默认提示词已锁定，点击开关解锁编辑',
          usingDefault: '当前使用系统默认提示词（留空则自动使用）',
          warning: '自定义提示词会影响AI拆分效果，取决于提示词质量和AI模型',
          viewDefault: '查看系统默认提示词',
          defaultPromptContent: `你是一个专业的学习卡片拆分助手，遵循"最小信息原则"。

你的任务是将一张包含多个知识点的父卡片拆分为多张独立的子卡片。每张子卡片应该只包含一个清晰的知识点。

拆分原则：
1. 每张子卡片只包含一个核心概念或知识点
2. 保持子卡片的独立性和完整性
3. 子卡片应该可以独立复习和理解
4. 保留必要的上下文，但避免重复信息
5. 保持原有的格式风格和表达方式

输出格式（JSON）：
{
  "cards": [
    {
      "front": "问题或提示",
      "back": "答案或解释",
      "tags": ["可选标签"],
      "explanation": "可选的额外说明"
    }
  ]
}`
        }
      }
    },
    
    // 数据管理
    dataManagement: {
      title: '数据管理',
      description: '管理插件数据的导入、导出和备份',
      panelTitle: '数据管理主面板组件',
      confirmDialog: {
        confirm: '确认',
        cancel: '取消',
        confirmPhrase: '确认操作',
        securityLevels: {
          safe: '安全操作',
          caution: '谨慎操作',
          danger: '危险操作'
        },
        operationDetails: '操作详情:',
        warnings: '注意事项:',
        typeToConfirm: '请输入 "{phrase}" 以确认操作:',
        inputMismatch: '输入的文本不匹配',
        processing: '处理中...',
        processingOverlay: '正在处理操作...'
      },
      progress: {
        calculating: '计算中...',
        cancelOperation: '取消操作',
        progressLabel: '进度:',
        elapsedTime: '已用时间:',
        remainingTime: '剩余时间:'
      },
      backupHistory: {
        title: '备份历史',
        noBackups: '暂无备份记录',
        showingRecent: '显示最近 {max} 个备份 (共 {total} 个)',
        totalBackups: '共 {count} 个备份',
        loadingBackups: '正在加载备份历史...',
        backupTypes: {
          auto: '自动备份',
          manual: '手动备份',
          preOperation: '操作前备份',
          scheduled: '定时备份',
          default: '备份'
        },
        corruptWarning: '备份文件可能已损坏',
        preview: '预览',
        previewTitle: '预览备份内容',
        restore: '恢复',
        restoreTitle: '从此备份恢复数据',
        delete: '删除',
        deleteTitle: '删除此备份',
        retentionHint: '系统自动保留最近 {max} 个备份，超出部分将被清理',
        processingBackup: '正在处理备份操作...'
      },
      folderTree: {
        title: '文件夹结构',
        stats: '{folders} 个文件夹, {files} 个文件',
        scannedAt: '扫描时间: {time}',
        noData: '暂无文件夹结构数据',
        collapse: '收起',
        expand: '展开',
        openFolder: '打开文件夹'
      },
      batchScan: {
        detected: '检测到:',
        newCards: '新增:',
        updated: '更新:',
        errors: '错误:',
        successRate: '成功率:',
        regexPresetSaved: '正则预设已保存',
        deletedMapping: '已删除映射',
        selectFileFirst: '请先选择{type}',
        selectDeckFirst: '请先选择目标牌组',
        confirmScanTitle: '确认扫描',
        confirmScanMessage: '确认要解析{type}"{path}"中的卡片到牌组"{deck}"吗？\n\n这将执行实际的卡片解析和保存操作。',
        cancelled: '已取消操作',
        startParsing: '开始解析{type}: {path}',
        batchServiceNotInit: '批量解析服务未初始化',
        savingCards: '开始保存 {count} 张卡片...',
        saveSuccess: '成功保存 {count} 张卡片到牌组"{deck}"！',
        saveFailed: '保存卡片失败: {error}',
        noCardsFound: '扫描完成，未找到符合条件的卡片。\n请检查文件中是否包含有效的 <-> 卡片分隔符。',
        scanFailed: '扫描失败: {error}',
        startScan: '开始扫描',
        deleteMapping: '删除映射',
        noDecksAvailable: '暂无可用牌组，请先在"牌组学习"界面创建牌组',
        tableHeaders: {
          type: '类型',
          path: '路径',
          fileMode: '文件模式',
          regexConfig: '正则配置',
          targetDeck: '目标牌组',
          subfolders: '子文件夹',
          cardCount: '卡片数量',
          enabled: '启用',
          actions: '操作'
        },
        typeFile: '文件',
        typeFolder: '文件夹',
        fileTooltip: '文件（点击切换到文件夹）',
        folderTooltip: '文件夹（点击切换到文件）',
        selectFilePath: '选择或输入文件路径...',
        selectFolderPath: '选择或输入文件夹路径...',
        singleFileCard: '单文件单卡片',
        multiFileCards: '单文件多卡片',
        noPresets: '暂无预设（请先创建）',
        selectPreset: '选择预设...',
        selectDeck: '选择牌组...',
        include: '包含',
        exclude: '排除',
        cardUnit: '张',
        notCounted: '未统计',
        actionsMenu: '操作菜单',
        moreActions: '更多操作',
        regexPreset: {
          title: '正则预设管理',
          newPreset: '+ 新建预设',
          officialPresets: '官方预设（快速导入）',
          customPresets: '自定义预设',
          modeSeparator: '分隔符',
          modePattern: '完整正则',
          syncTagBased: '标签判断',
          syncFullSync: '完全同步',
          edit: '编辑',
          delete: '删除',
          createTitle: '新建正则预设',
          editTitle: '编辑正则预设',
          close: '关闭',
          presetName: '预设名称',
          presetNamePlaceholder: '例如：默认Weave格式',
          parsingMode: '解析模式',
          separatorMode: '分隔符模式（简单）',
          patternMode: '完整正则模式（灵活）',
          cardPattern: '卡片匹配正则表达式',
          cardPatternPlaceholder: '例如：Q:\\s*(.+?)\\s*A:\\s*(.+?)',
          cardPatternHelp: '直接在全文中匹配所有卡片，通过捕获组（括号）提取问题和答案',
          regexFlags: '正则标志',
          regexFlagsPlaceholder: '例如：gs',
          regexFlagsHelp: 'g=全局匹配，s=允许.匹配换行，i=忽略大小写，m=多行模式',
          syncMethod: '同步方法',
          tagBasedMode: '标签判断模式',
          fullSyncMode: '完全同步模式',
          cancel: '取消',
          save: '保存',
          nameEmpty: '预设名称不能为空',
          nameDuplicate: '预设名称已存在',
          separatorEmpty: '卡片分隔符不能为空',
          separatorInvalid: '分隔符正则无效: {error}',
          patternEmpty: '卡片匹配正则不能为空',
          patternInvalid: '卡片匹配正则无效: {error}',
          created: '预设已创建',
          saved: '预设已保存',
          confirmDelete: '确定要删除预设 "{name}" 吗？',
          confirmDeleteTitle: '确认删除',
          deleted: '预设已删除',
          alreadyExists: '预设 "{name}" 已存在',
          imported: '已导入预设 "{name}"',
          newPresetName: '新预设',
          mode: '模式:',
          sync: '同步:'
        },
        separator: {
          cardSeparatorMethod: '卡片分隔方式',
          useCustomSeparator: '使用自定义分隔符',
          useEmptyLine: '使用空行分隔',
          emptyLineCount: '空行数量',
          emptyLineCountPlaceholder: '例如：2',
          emptyLineCountHelp: '连续的空行数量（默认2行）',
          cardRangeSeparator: '卡片范围分隔符',
          cardRangeSeparatorPlaceholder: '例如：%%<->%%',
          cardRangeSeparatorHelp: '用于分隔卡片范围'
        },
        cardId: {
          title: '卡片识别系统',
          desc: '为卡片分配唯一标识符，防止重复导入，支持卡片更新追踪。适用于批量解析和单卡创建。',
          helpTitle: '工作原理',
          helpFirstParse: '首次解析：',
          helpFirstParseDesc: '为每张卡片生成UUID并插入到源文件',
          helpSubsequentParse: '后续解析：',
          helpSubsequentParseDesc: '检测UUID，识别已导入的卡片',
          helpDuplicateHandle: '重复处理：',
          helpDuplicateHandleDesc: '根据策略决定跳过、更新或创建新卡片',
          helpWarning: '注意：',
          helpWarningDesc: '启用后会自动修改源文件内容插入UUID标记。虽然这些标记设计为尽可能不干扰阅读，但仍建议在首次使用前备份重要笔记。',
          showHelp: '显示说明',
          hideHelp: '隐藏说明',
          enableSystem: '启用卡片识别系统',
          enableDesc: '在源文件中插入唯一标识符，防止重复导入同一内容',
          uuidPrefix: 'UUID前缀',
          uuidPrefixHint: '用于识别Weave生成的UUID，建议使用易识别的前缀',
          uuidFormat: 'UUID格式',
          formatComment: 'HTML注释',
          formatFrontmatter: 'Frontmatter',
          formatInlineCode: '行内代码',
          formatCommentNote: '推荐：不影响笔记渲染，对阅读无干扰',
          formatFrontmatterNote: '适合已使用Frontmatter的笔记',
          formatInlineCodeNote: '显示为行内代码，阅读时可见',
          insertPosition: 'UUID插入位置',
          posBeforeCard: '卡片前',
          posAfterCard: '卡片后',
          posInMetadata: '元数据中',
          duplicateStrategy: '重复UUID处理策略',
          strategySkip: '跳过重复',
          strategySkipDesc: '检测到重复UUID时，跳过该卡片的导入，不创建新卡片',
          strategySkipUse: '适用于：防止意外重复导入',
          strategyUpdate: '更新现有',
          strategyUpdateDesc: '检测到重复UUID时，更新已存在的卡片内容',
          strategyUpdateUse: '适用于：同步更新笔记变更',
          strategyCreateNew: '创建新卡片',
          strategyCreateNewDesc: '检测到重复UUID时，生成新UUID并创建新卡片',
          strategyCreateNewUse: '适用于：允许同一内容创建多张卡片',
          advancedOptions: '高级选项',
          autoFixMissing: '自动修复缺失的UUID',
          autoFixMissingDesc: '解析时发现卡片缺少UUID，自动生成并插入',
          configPreview: '当前配置预览',
          previewFormat: 'UUID格式：',
          previewPosition: '插入位置：',
          previewStrategy: '重复策略：',
          disabledTitle: 'UUID识别功能未启用',
          disabledDesc: '当前每次解析都会创建新卡片，可能导致重复内容。\n启用UUID识别可以：',
          disabledBenefit1: '防止同一笔记被多次导入',
          disabledBenefit2: '支持更新已导入的卡片',
          disabledBenefit3: '维护卡片与笔记的对应关系',
          enableNow: '立即启用'
        },
        scanResults: {
          title: '批量扫描结果',
          close: '关闭',
          totalCards: '总卡片数',
          newLabel: '新增',
          updatedLabel: '更新',
          skippedLabel: '跳过（未变化）',
          conflictLabel: '冲突',
          errorsLabel: '错误',
          parseFailed: '解析失败',
          duplicateUUID: '重复UUID',
          filesProcessed: '处理文件:',
          filesWithCards: '包含卡片:',
          filesSkipped: '跳过文件:',
          newDecksCreated: '新建牌组:',
          scanDuration: '扫描耗时:',
          avgSpeed: '平均速度:',
          cardsPerSec: '张/秒',
          fileUnit: '个',
          seconds: '秒',
          viewErrors: '查看错误详情',
          viewConflicts: '查看冲突详情',
          conflictHint: '以下卡片在源文件和Weave中都被修改，需要手动解决冲突：',
          cardIndex: '第{index}张卡片',
          useSourceVersion: '使用源文件版本',
          keepWeaveVersion: '保留Weave版本',
          viewDuplicates: '查看重复UUID详情',
          duplicateHint: '以下UUID在数据库中已存在，可能导致卡片冲突或数据覆盖：',
          viewNewDecks: '查看新建牌组详情',
          newDecksHint: '批量扫描过程中自动创建了以下牌组：'
        }
      },
      batchScope: {
        autoTriggerTitle: '批量解析自动触发',
        usageTips: '使用提示',
        tipAutoTrigger: '自动触发',
        tipAutoTriggerDesc: '编辑文件时自动解析（仅当前文件）',
        tipManualTrigger: '手动触发',
        tipManualTriggerDesc: '使用快捷键执行批量解析命令',
        tipShortcut: '快捷键设置',
        tipShortcutDesc: '在 Obsidian 设置 → 快捷键 中搜索“批量解析”',
        tipPerformance: '性能建议',
        tipPerformanceDesc: '防抖延迟建议 2000ms，批量处理限制在 50 个文件',
        enableAutoTrigger: '启用自动触发',
        enableAutoTriggerDesc: '在编辑文件时自动检测并解析批量范围（仅限当前活动文件）',
        debounceDelay: '防抖延迟（毫秒）',
        debounceHint: '编辑停止后等待多久才触发解析（建议 1000-3000ms）',
        activeFileOnly: '仅限活动文件',
        activeFileOnlyDesc: '自动触发仅对当前正在编辑的文件生效',
        batchConfigTitle: '批量解析配置',
        defaultDeck: '默认牌组',
        defaultDeckHint: '批量解析创建的卡片将默认添加到此牌组。如果不指定，将使用第一个可用牌组。',
        useFirstDeck: '（使用第一个可用牌组）',
        defaultPriority: '默认优先级',
        defaultPriorityHint: '批量解析创建的卡片的默认优先级（0-10，0为最低）',
        folderScopeTitle: '文件夹扫描范围',
        includeFolders: '包含的文件夹',
        includeFoldersHint: '指定需要扫描的文件夹。留空则扫描整个库（除排除列表外）。',
        excludeFolders: '排除的文件夹',
        excludeFoldersHint: '指定需要排除的文件夹（不会被扫描）',
        rootDir: '(根目录)',
        removeFolder: '移除文件夹',
        selectFolder: '选择文件夹',
        addFolder: '+ 添加文件夹',
        maxFilesPerBatch: '单次批量处理最大文件数',
        maxFilesHint: '手动触发批量解析时，一次最多处理多少个文件（防止性能问题）',
        scopePreview: '扫描范围预览',
        previewInclude: '包含文件夹:',
        previewExclude: '排除文件夹:',
        previewAutoTrigger: '自动触发:',
        allFolders: '全部',
        enabled: '已启用',
        disabled: '已禁用'
      },
      templateMgmt: {
        copyLabel: '(副本)',
        deleteLinkedWarning: '警告：该模板关联了 {count} 张卡片。\n\n删除模板后，这些卡片也将被删除，且无法恢复！\n\n确定要继续吗？',
        confirmDelete: '确认删除',
        deleteBtn: '删除',
        deleteCardsFailed: '删除关联卡片失败，操作已取消',
        confirmDeleteSimple: '确定要删除这个模板吗？',
        deletedWithCards: '已删除模板及其关联的 {count} 张卡片',
        deletedTemplate: '已删除模板'
      },
      templateEditor: {
        viewDetails: '查看模板详情',
        templateName: '模板名称',
        templateNamePlaceholder: '例如：基础问答卡',
        templateDesc: '模板描述',
        templateDescPlaceholder: '模板用途说明',
        cardType: '题型分类',
        cardTypeQA: '问答题',
        cardTypeChoice: '选择题',
        cardTypeCloze: '挖空题',
        cardTypeOther: '其他',
        cardTypeHelp: '此模板用于AI生成和单卡编辑',
        parsingMode: '解析模式',
        singleFieldParsing: '单字段解析',
        singleFieldDesc: '此模板使用单字段解析模式，适用于AI生成和单卡编辑场景。',
        singleFieldNote: '批量解析功能已迁移到“分隔符配置”标签页。',
        fieldConfig: '字段配置',
        regexTag: '正则',
        requiredTag: '必需',
        close: '关闭'
      },
      systemPrompt: {
        useBuiltin: '使用内置系统提示词',
        useBuiltinDesc: '内置系统提示词包含完整的格式规范和生成要求，确保生成标准化的学习卡片。',
        builtinTitle: '内置系统提示词',
        readonlyBadge: '只读',
        collapse: '收起',
        viewContent: '查看内容',
        previewNote: '此为示例预览（基于默认配置），实际使用时会根据生成配置动态调整',
        builtinPurpose: '内置系统提示词的作用：',
        builtinBenefit1: '定义标准的卡片JSON格式（问答题、挖空题、选择题）',
        builtinBenefit2: '说明必需的字段和可选的增强字段（Hint、Explanation等）',
        builtinBenefit3: '规范选择题的{\u2713}标记语法',
        builtinBenefit4: '指导生成高质量的学习卡片',
        customTitle: '自定义系统提示词',
        customBadge: '自定义',
        useAsTemplate: '使用内置作为模板',
        useAsTemplateTitle: '使用内置提示词作为起点',
        restoreDefault: '恢复默认',
        editPrompt: '编辑系统提示词',
        lastModified: '最后修改：',
        confirmRestore: '确定要恢复默认的系统提示词吗？这将清空您的自定义内容。',
        confirmRestoreTitle: '确认恢复默认',
        confirmOverwrite: '这将覆盖当前的自定义内容，确定继续吗？',
        confirmOverwriteTitle: '确认覆盖',
        warningTitle: '注意事项：',
        warning1: '自定义系统提示词可能导致生成的卡片格式不符合Weave要求',
        warning2: '请确保包含必要的JSON格式说明和字段定义',
        warning3: '选择题必须说明使用 {\u2713} 标记正确答案',
        warning4: '挖空题必须说明使用 ==文本== 语法',
        warning5: '建议先使用“内置作为模板”，然后在此基础上修改',
        availableVars: '可用变量',
        varCardCount: '卡片数量',
        varDifficulty: '难度等级',
        varQaPercent: '问答题百分比',
        varClozePercent: '挖空题百分比',
        varChoicePercent: '选择题百分比',
        varAutoReplace: '这些变量会在实际使用时自动替换为相应的值',
        editorPlaceholder: '在此输入自定义系统提示词...'
      },
      officialStandard: '官方标准',
      panelDescription: '集成所有数据管理功能的统一界面',
      initFailed: '服务初始化失败',
      refreshFailed: '刷新失败，请重试',
      confirmPhrase: '确认操作',
      resetConfirmPhrase: '确认重置',
      importExport: {
        title: '导入导出',
        import: {
          title: '导入数据',
          button: '导入',
          selectFile: '选择文件',
          importing: '导入中...',
          success: '数据导入成功',
          successDetail: '导入: {imported} 条，跳过: {skipped} 条',
          failed: '导入失败',
          confirm: '确定要导入数据吗？此操作将覆盖现有数据！',
          details: {
            fileName: '文件名: {name}',
            fileSize: '文件大小: {size} MB',
            autoBackup: '导入前将自动创建备份'
          },
          warnings: {
            override: '现有数据可能被覆盖',
            format: '请确保导入文件格式正确',
            backup: '建议先创建手动备份'
          }
        },
        export: {
          title: '导出数据',
          button: '导出',
          exporting: '导出中...',
          success: '数据导出成功',
          successDetail: '文件: {path}',
          failed: '导出失败',
          confirm: '确定要导出所有数据吗？',
          details: {
            all: '将导出所有牌组和卡片数据',
            records: '包含学习记录和用户设置',
            format: '生成JSON格式的导出文件'
          }
        }
      },
      backup: {
        title: '数据备份',
        latest: {
          title: '最新备份',
          lastGenerated: '最后生成',
          dataFolder: '数据文件夹',
          justNow: '刚刚',
          stats: {
            totalSize: '总大小',
            deckCount: '牌组数量',
            cardTotal: '卡片总量',
            backupCount: '保存总数'
          }
        },
        history: {
          title: '备份历史',
          tableHeaders: {
            backupTime: '备份时间',
            backupType: '备份方式',
            backupSize: '备份大小',
            actions: '操作'
          },
          type: {
            manual: '手动',
            auto: '自动'
          },
          actions: {
            restore: '恢复',
            delete: '删除',
            export: '导出'
          }
        },
        operations: {
          integrityCheck: '完整性检查',
          exportData: '导出数据',
          importData: '导入数据',
          clearAll: '直接清空',
          createBackup: '立即备份'
        },
        auto: {
          title: '自动备份配置',
          description: '定期自动创建数据备份，保护您的学习数据安全',
          enable: '启用自动备份',
          enableDesc: '定期自动创建数据备份',
          interval: '备份间隔',
          intervalDesc: '自动备份的时间间隔（1-168 小时）',
          intervalUnit: '小时',
          triggers: {
            title: '触发条件',
            onStartup: '启动时备份',
            onStartupDesc: '插件启动时自动创建备份',
            onCardThreshold: '卡片数量阈值备份',
            onCardThresholdDesc: '卡片数量变化达到阈值时自动备份',
            thresholdCount: '阈值数量',
            thresholdCountDesc: '卡片数量变化达到此值时触发备份',
            thresholdUnit: '张卡片'
          }
        },
        manual: {
          title: '手动备份',
          label: '手动备份',
          create: '立即备份',
          creating: '备份中...',
          success: '备份创建成功',
          successDetail: '大小: {size} MB',
          failed: '创建备份失败'
        },
        list: {
          title: '备份列表',
          description: '所有可用的备份记录',
          loading: '加载中...',
          colType: '类型',
          colTime: '时间',
          colDevice: '设备',
          colContent: '内容',
          colSize: '大小',
          colTrigger: '触发方式',
          colStatus: '状态',
          colActions: '操作',
          globalBackup: '全局备份',
          cardCount: '{count} 张卡片',
          compressed: '压缩 {ratio}%',
          healthy: '健康',
          unhealthy: '异常',
          encrypted: '加密',
          details: '详情',
          collapse: '收起',
          restore: '恢复',
          delete: '删除',
          confirmRestore: '确定要恢复此备份吗？这将覆盖当前数据。',
          confirmRestoreTitle: '确认恢复',
          confirmDelete: '确定要删除此备份吗？此操作不可恢复。',
          confirmDeleteTitle: '确认删除',
          triggerAutoImport: '自动(导入)',
          triggerAutoSync: '自动(同步)',
          triggerManual: '手动',
          triggerScheduled: '定时',
          triggerPreUpdate: '更新前',
          triggerUnknown: '未知',
          yesterday: '昨天 ',
          basicInfo: '基本信息',
          backupId: '备份ID:',
          pluginVersion: '插件版本:',
          obsidianVersion: 'Obsidian版本:',
          vaultName: '仓库名称:',
          notes: '备注',
          tags: '标签',
          fileInfo: '文件信息',
          storagePath: '存储路径:',
          backupType: '备份类型:',
          fullBackup: '完整备份',
          incrementalBackup: '增量备份',
          baseBackup: '基础备份:',
          prevPage: '\u2190 上一页',
          pageInfo: '第 {current} / {total} 页',
          nextPage: '下一页 \u2192'
        },
        mgmt: {
          statsTitle: '备份统计',
          statsDesc: '当前备份系统的总体情况',
          totalBackups: '总备份',
          totalSize: '总大小',
          compressedBackups: '压缩备份',
          deviceCount: '设备数量',
          creating: '创建中...',
          createBackup: '创建备份',
          refreshing: '刷新中...',
          refresh: '刷新',
          loadFailed: '加载备份数据失败',
          manualReason: '用户手动创建备份',
          createSuccess: '备份创建成功',
          createFailed: '备份创建失败: ',
          restoreSuccess: '成功恢复 {count} 项数据',
          restoreFailed: '恢复失败: ',
          deleted: '备份已删除',
          deleteFailed: '删除失败',
          deleteFailedDetail: '删除备份失败: ',
          cleanupDone: '清理完成: 成功 {success}, 失败 {failed}',
          cleanupFailed: '批量清理失败: '
        }
      },
      notices: {
        fixFolderTitle: '修复 Weave 文件夹',
        fixFolderMsg: '检测到旧位置仍存在数据目录，将合并到当前设置的父目录并修复增量阅读路径引用。',
        fixComplete: '修复完成',
        fixFailed: '修复失败: ',
        moveFolderTitle: '移动 Weave 文件夹',
        moveFolderMsg: '将移动可读内容文件夹到新的父目录。',
        moveComplete: 'Weave 文件夹位置已更新',
        moveFailed: '更新失败: ',
        restoreTitle: '恢复备份',
        restoreMsg: '确定要从备份恢复数据吗？',
        restoreSuccess: '数据恢复成功\n恢复文件数: {count}',
        restoreFailed: '恢复失败',
        restoreFailedDetail: '恢复失败: ',
        resetTitle: '重置所有数据',
        resetMsg: '此操作将永久删除所有数据！',
        resetSuccess: '数据重置成功\n已清理 {count} 条记录',
        resetFailed: '重置失败',
        resetFailedDetail: '重置失败: ',
        integrityPass: '数据完整性检查通过\n得分: {score}/100',
        integrityIssues: '发现 {count} 个严重问题\n得分: {score}/100',
        integrityResultTitle: '数据完整性检查结果',
        integrityResultMsg: '检查得分: {score}/100',
        integrityFailed: '完整性检查失败',
        deleteBackupTitle: '删除备份',
        deleteBackupMsg: '确定要删除此备份吗？',
        backupDeleted: '备份已删除',
        deleteBackupFailed: '删除备份失败',
        repairSuccess: '成功修复 {count} 个备份',
        repairFailed: '批量修复失败',
        cleanInvalidTitle: '清理无效备份',
        cleanInvalidMsg: '确定要删除所有无效的备份吗？',
        cleanInvalidFailed: '清理无效备份失败',
        backupPreviewTitle: '备份预览',
        closeBtn: '关闭',
        corruptBackupsFound: '发现 {count} 个损坏的备份',
        corruptBackupsDesc: '这些备份可能缺少必要文件或元数据损坏，建议尝试自动修复或直接清理',
        autoRepairAll: '自动修复全部',
        cleanupInvalid: '清理无效备份',
        moreBackupsHint: '还有 {count} 个备份未显示',
        noBackupRecords: '暂无备份记录',
        selectBtn: '选择'
      },
      weaveDataFolder: {
        title: 'Weave 本地数据文件夹',
        desc: '该文件夹是插件所有数据的本地存储位置，包含记忆牌组、增量阅读、题库等全部数据，非常重要，请勿手动删除或移动',
        locationLabel: '文件夹位置',
        irImportFolderLabel: '增量阅读导入材料存储文件夹',
        irImportFolderDesc: '导入的文件将复制保存到此文件夹，原文件保持不变'
      }
    },
    
    // AnkiConnect同步
    ankiConnect: {
      title: 'AnkiConnect 同步',
      sectionTitle: 'Anki同步设置',
      description: '连接到 Anki 桌面应用，实现双向卡片同步',
      enable: {
        label: '启用 AnkiConnect',
        description: '连接到 Anki 桌面应用，实现双向卡片同步'
      },
      connection: {
        title: '连接管理',
        status: '连接状态',
        statusLabel: {
          connected: '已连接',
          disconnected: '未连接',
          testing: '测试中...'
        },
        testConnection: '测试连接',
        address: {
          label: 'AnkiConnect 地址',
          placeholder: 'http://localhost:8765',
          description: 'AnkiConnect API的地址'
        },
        testing: '测试中...',
        notTested: '未测试',
        connected: '已连接',
        disconnected: '未连接',
        testButton: '测试连接',
        testingButton: '测试中...',
        endpointLabel: 'AnkiConnect 端点',
        endpointDesc: 'AnkiConnect API 的地址'
      },
      autoSync: {
        title: '自动同步配置',
        enable: '启用自动同步',
        enableDesc: '按设定间隔自动同步卡片到 Anki',
        enableLabel: '启用自动同步',
        intervalLabel: '同步间隔（分钟）',
        intervalDesc: '定时同步的时间间隔',
        syncOnStartupLabel: '启动时同步',
        syncOnStartupDesc: 'Obsidian 启动时自动执行同步',
        fileWatcherLabel: '文件变更检测',
        fileWatcherDesc: '检测到卡片文件修改时自动同步'
      },
      deckSync: {
        title: '牌组同步配置',
        enable: '启用牌组同步',
        enableDesc: '同步牌组数据到Anki',
        description: '配置 Weave 牌组与 Anki 牌组的映射关系',
        apiV6: '可选: 启用 API v6',
        discovered: '已发现 {count} 张 Anki 牌组',
        configureMapping: '配置映射'
      },
      deckMapping: {
        neverSynced: '从未同步',
        justNow: '刚刚',
        minutesAgo: '{n}分钟前',
        hoursAgo: '{n}小时前',
        daysAgo: '{n}天前',
        importFromAnki: '从 Anki 导入',
        exportToAnki: '导出到 Anki',
        bidirectionalSync: '双向智能同步',
        deleteMapping: '删除映射',
        batchExportToAnki: '批量导出到 Anki',
        batchImportFromAnki: '批量从 Anki 导入',
        batchBidirectionalSync: '批量双向同步',
        noEnabledMappings: '没有启用的牌组映射',
        bidirectionalNotEnabled: '双向同步未启用，请在高级设置中启用',
        enabledCount: '{count} 个已启用',
        noWeaveDecks: '未找到 Weave 牌组',
        noWeaveDecksHint: '请先在“牌组学习”界面中创建至少一个牌组，然后刷新此页面。',
        tableHeaders: {
          weaveDeck: 'Weave 牌组',
          ankiDeck: 'Anki 牌组',
          syncDirection: '同步方向',
          contentConversion: '内容转换',
          status: '状态',
          lastSync: '上次同步',
          actions: '操作'
        },
        directions: {
          toAnki: '到 Anki',
          fromAnki: '从 Anki',
          bidirectional: '双向'
        },
        contentOptions: {
          standard: '标准',
          preserveStyle: '尽量保留样式',
          minimal: '最少转换'
        },
        toggleEnable: '点击启用同步',
        toggleDisable: '点击禁用同步',
        actionsMenu: '操作菜单',
        moreActions: '更多操作',
        help: {
          title: '使用说明',
          closeHelp: '关闭帮助',
          mappingCount: '已配置 {count} 个映射关系',
          mappingCountDesc: '打开开关即可启用同步，点击同步按钮执行数据同步',
          howToUse: '如何使用',
          howToUseItems: [
            '启用同步：点击表格中的开关启用或禁用该映射',
            '单个同步：点击操作菜单（•••）选择同步方向',
            '批量同步：点击右上角菜单（•••）批量操作所有启用的映射'
          ],
          syncDirections: '同步方向说明',
          syncDirectionItems: [
            '→ 到 Anki：将 Weave 卡片导出到 Anki',
            '← 从 Anki：从 Anki 导入卡片到 Weave',
            '⇄ 双向：智能双向同步（需要激活高级功能）'
          ],
          gotIt: '知道了'
        }
      },
      sectionSync: {
        title: '板块同步配置',
        enable: '启用板块同步',
        enableDesc: '同步板块内容到Anki'
      },
      syncProgress: {
        processing: '正在处理：',
        deckProgress: '牌组进度：',
        cancelLabel: '取消操作',
        cancelButton: '取消'
      },
      addMapping: {
        title: '添加新的牌组映射',
        weaveDeckLabel: 'Weave 牌组',
        weaveDeckPlaceholder: '请选择 Weave 牌组...',
        ankiDeckLabel: 'Anki 牌组',
        ankiDeckPlaceholder: '请选择 Anki 牌组...',
        syncDirectionLabel: '同步方向',
        contentConversionLabel: '内容转换',
        addButton: '添加'
      },
      toolbar: {
        fetching: '获取中...',
        fetchAnkiDecks: '获取 Anki 牌组列表',
        deckCount: '已发现 {count} 个 Anki 牌组',
        createWeaveFirst: '请先创建 Weave 牌组',
        fetchAnkiFirst: '请先获取 Anki 牌组列表',
        cancelAdd: '取消添加',
        addMapping: '添加映射'
      },
      advanced: {
        mediaSyncLabel: '启用媒体同步',
        mediaSyncDesc: '同步图片、音频等媒体文件到 Anki'
      },
      notices: {
        connectSuccess: '连接成功！Anki 正在运行',
        connectHint: '点击"获取 Anki 牌组列表"开始配置',
        connectFailed: '连接失败：',
        connectTestFailed: '连接测试失败：',
        pleaseTestFirst: '请先测试连接',
        dataRefreshed: '牌组数据已刷新',
        refreshFailed: '刷新数据失败：',
        fetchedDecks: '已获取 {count} 个 Anki 牌组，请手动添加映射',
        fetchDecksFailed: '获取牌组失败：',
        fetchedModels: '已获取 {count} 个模板',
        fetchModelsFailed: '获取模板失败：',
        mappingExists: '映射已存在: {name}',
        mappingAdded: '已添加映射: {weave} ⇄ {anki}',
        pleaseInitFirst: '请点击"测试连接"进行初始化',
        mappingNotFound: '牌组映射不存在',
        bidirectionalSyncing: '正在双向同步 "{name}"...',
        importWarnings: '有 {count} 个警告，请查看控制台',
        importFailed: '导入失败：',
        noEnabledMappings: '没有启用的牌组映射',
        batchFailed: '批量处理失败：',
        startupFailed: '启动失败: ',
        saveFailed: '保存设置失败',
        dataExpired: '牌组数据可能已过期，建议重新获取',
        copiedToClipboard: '已复制到剪贴板',
        copyBtn: '复制',
        syncingCards: '正在同步卡片',
        importingCards: '正在导入卡片',
        preparing: '正在准备...',
        processing: '正在处理...',
        exportToAnkiTitle: '导出到 Anki',
        importFromAnkiTitle: '从 Anki 导入',
        bidirectionalSyncTitle: '双向智能同步',
        syncComplete: '"{name}" 同步完成!\n导出: {exported} 张 | 跳过: {skipped} 张',
        syncFailed: '同步失败',
        ankiNotRunning: 'Anki 未运行，请先启动 Anki',
        deckNotAccessible: '牌组不存在或无法访问',
        importingFromAnki: '正在从 Anki 导入...',
        exportingToAnki: '正在导出到 Anki...',
        importPrefix: '导入: ',
        exportPrefix: '导出: ',
        bidirectionalComplete: '"{name}" 双向同步完成!\n导入: {imported} 张 | 导出: {exported} 张\n跳过: {skipped} 张',
        bidirectionalFailed: '双向同步失败',
        importComplete: '导入完成！\n卡片: {cards} 张\n模板: {templates} 个\n跳过: {skipped} 张',
        exportFailed: '导出失败',
        importFailedError: '导入失败',
        batchExportTitle: '批量导出到 Anki',
        batchImportTitle: '批量从 Anki 导入',
        batchBidirectionalTitle: '批量双向同步',
        batchComplete: '批量处理完成！\n成功: {success}/{total} 个牌组 | 总卡片: {cards} 张',
        batchCompleteWithErrors: '批量处理完成（有错误）\n成功: {success} | 失败: {failed}\n详情请查看控制台',
        settingsSaved: 'AnkiConnect 设置已保存',
        serviceStarted: 'AnkiConnect 服务已启动',
        serviceStopped: 'AnkiConnect 服务已停止',
        fetchModelsTitle: '获取 Anki 模板',
        testing: '测试中...',
        notTested: '未测试',
        connected: '已连接',
        disconnected: '未连接',
        corsTitle: 'AnkiConnect CORS 配置',
        corsDesc: '请在 Anki 的 工具 → 插件 → AnkiConnect → 配置 中，将 "app://obsidian.md" 添加到 webCorsOriginList 数组中，否则无法正常同步卡片。'
      },
      syncLog: {
        title: '同步日志',
        description: '最近的同步记录',
        totalSyncs: '总同步',
        success: '成功',
        failed: '失败',
        successRate: '成功率',
        tableHeaders: {
          time: '时间',
          direction: '方向',
          success: '成功',
          failed: '失败',
          skipped: '跳过',
          duration: '耗时'
        },
        yesterday: '昨天',
        seconds: '秒',
        minuteSeconds: '{min}分{sec}秒',
        prevPage: '← 上一页',
        nextPage: '下一页 →',
        pageInfo: '第 {current} / {total} 页',
        clearLogs: '清空日志'
      }
    },
    
    // 增量阅读设置
    irSettings: {
      importTitle: '导入设置',
      importFolderLabel: '导入材料存储文件夹',
      importFolderDesc: 'PDF、EPUB 等导入文件会复制保存到此文件夹；MD 文件直接使用源文档，不复制副本',
      selectBtn: '选择',
      scheduleTitle: '牌组调度',
      dailyNewLabel: '每日新块上限',
      dailyNewDesc: '每天学习的新内容块数量上限',
      dailyReviewLabel: '每日复习上限',
      dailyReviewDesc: '每天复习的内容块数量上限',
      learnAheadLabel: '待读天数',
      learnAheadDesc: '统计N天内到期的内容块显示为"待读"，可提前阅读',
      intervalFactorLabel: '间隔增长因子',
      intervalFactorDesc: '每次复习后间隔天数的增长倍数',
      reviewThresholdLabel: '复习阈值（天）',
      reviewThresholdDesc: '间隔达到此天数后进入复习状态',
      maxIntervalLabel: '最大间隔（天）',
      maxIntervalDesc: '复习间隔的上限天数',
      splitTitle: '内容拆分',
      splitLevelLabel: '默认拆分级别',
      splitLevelDesc: '导入文件时按此级别的标题拆分（1-6对应#到######）',
      strategyTitle: '调度策略',
      strategyLabel: '调度策略',
      strategyDesc: '选择适合您阅读习惯的调度模式',
      timeBudgetLabel: '每日时间预算',
      timeBudgetDesc: '每天计划用于增量阅读的时间',
      maxAppearancesLabel: '同块每日上限',
      maxAppearancesDesc: '同一内容块每天最多出现的次数（防刷屏）',
      advancedTitle: '高级调度',
      tagGroupPriorLabel: '启用标签组先验',
      tagGroupPriorDesc: '根据材料类型自动调整间隔增长因子',
      tagGroupFollowLabel: '标签组自动跟随',
      tagGroupFollowDesc: '文档标签变化后，自动检测并切换到匹配的标签组',
      agingStrengthLabel: '防沉底强度',
      agingStrengthDesc: '长期未读内容获得额外优先级提升的力度',
      postponeLabel: '过载自动后推',
      postponeDesc: '到期内容过多时自动后推低优先级内容',
      priorityHalfLifeLabel: '优先级平滑半衰期',
      priorityHalfLifeDesc: '优先级变化的平滑程度（天数越大越平滑）',
      interleaveTitle: '交错学习',
      interleaveModeLabel: '启用交错学习',
      interleaveModeDesc: '混合不同牌组/主题的内容块，提升学习效果',
      maxConsecutiveLabel: '最大连续同主题数',
      maxConsecutiveDesc: '超过此数量后强制切换到其他主题',
      unitBlocks: '块',
      unitMinutes: '分钟',
      unitTimes: '次',
      unitDays: '天',
      calloutSignalTitle: '标注信号',
      calloutSignalLabel: '启用标注信号',
      calloutSignalDesc: '使用 Callout 标注影响内容块的调度优先级',
      calloutTypeWeightsLabel: 'Callout 类型权重',
      calloutTypeWeightsDesc: '选择参与调度的标注类型并配置权重（0.5~3.0）',
      deleteBtn: '删除',
      calloutTypePlaceholder: '输入 Callout 类型名称',
      addBtn: '添加',
      maxBoostLabel: '最大增益',
      maxBoostDesc: '标注对优先级的最大修正幅度（1.0~2.0）',
      saturationLabel: '饱和速度',
      saturationDesc: '标注数量增益的饱和速度（越小越快饱和，防刷标注）',
      strategyHintReadingList: '阅读清单模式：每个内容块每天最多出现1次，适合轻度浏览和广泛阅读',
      strategyHintProcessing: '加工流模式：同日可多次回访同一内容，适合深度处理、摘录和制卡',
      followOff: '关闭',
      followOffDesc: '导入时确定后不再变化',
      followAsk: '询问',
      followAskDesc: '检测到变化时通知确认',
      followAuto: '自动',
      followAutoDesc: '静默自动切换标签组',
      minContentLabel: '最小内容阈值',
      minContentDesc: 'Callout 内容少于此字符数不计入（0=不启用）',
      unitChars: '字',
      algorithmHintTitle: '算法说明',
      algorithmHintContent: '前几个标注带来明显增益，随后收益递减。最终修正值限制在 [0, maxBoost] 区间内。',
      strategyProcessingLabel: '加工流',
      strategyProcessingDesc: '同日可多次回访，适合深度处理',
      strategyReadingListLabel: '阅读清单',
      strategyReadingListDesc: '每天最多出现1次，适合轻度浏览',
      agingLowLabel: '低',
      agingLowDesc: '长期未读内容缓慢提升优先级',
      agingMediumLabel: '中',
      agingMediumDesc: '适度防沉底',
      agingHighLabel: '高',
      agingHighDesc: '积极防止内容被遗忘',
      postponeOffLabel: '关闭',
      postponeOffDesc: '不自动后推',
      postponeGentleLabel: '温和',
      postponeGentleDesc: '仅后推低优先级内容',
      postponeAggressiveLabel: '积极',
      postponeAggressiveDesc: '更多内容被后推以控制负载'
    },
    // 增量阅读标签组
    irTagGroup: {
      cannotDeleteDefault: '不能删除默认标签组',
      deleteConfirm: '确定要删除标签组「{name}」吗？\n该组下的文档将回归默认组。',
      deleted: '已删除标签组「{name}」',
      deleteFailed: '删除失败',
      saveFailed: '保存失败: ',
      tagExists: '标签已存在',
      nameRequired: '请输入标签组名称',
      tagRequired: '请至少添加一个匹配标签',
      updated: '已更新标签组「{name}」',
      created: '已创建标签组「{name}」',
      managerTitle: '材料类型标签组',
      managerDesc: '按标签对阅读材料分组，每组可学习独立的调度节奏参数',
      createBtn: '新建标签组',
      loading: '加载中...',
      loadFailed: '加载失败: ',
      retryBtn: '重试',
      colName: '名称',
      colTags: '标签',
      colDocs: '文档数',
      colFactor: '间隔因子',
      colSamples: '样本量',
      colPriority: '优先级',
      colActions: '操作',
      defaultGroupHint: '未匹配任何标签组的文档将使用默认组参数',
      editor: {
        nameLabel: '标签组名称',
        nameHint: '用于识别这类阅读材料的名称',
        tagsLabel: '匹配标签',
        tagsHint: '文档包含任一标签即归入此组',
        matchSourceLabel: '匹配源',
        matchSourceHint: '选择从文档的哪些位置提取标签进行匹配',
        inlineTags: '内联 #标签',
        customYaml: '自定义 YAML 属性',
        priorityLabel: '匹配优先级',
        priorityHint: '数值越小优先级越高。当文档匹配多个标签组时，优先归入优先级高的组。',
        algorithmNoteTitle: '调度参数说明',
        algorithmNoteContent: '标签组创建后，系统会为其初始化默认调度参数（间隔因子=1.5）。随着该组文档的学习积累，参数会通过收缩学习（shrinkage）逐渐适应该类型材料的最佳节奏。',
        cancelBtn: '取消',
        saveBtn: '保存',
        createBtn: '创建'
      },
      stats: {
        title: '参数学习统计',
        intervalFactor: '间隔因子',
        coldStartMultiplier: '冷启动乘子',
        sampleCount: '学习样本量',
        lastUpdated: '最后更新',
        trendTitle: '变化趋势',
        noHistory: '暂无历史数据',
        noHistoryHint: '参数学习后将在此展示变化趋势',
        paramNoteTitle: '参数说明',
        paramNoteContent: '间隔因子决定复习间隔的增长速度。值越大，间隔增长越快。系统会根据阅读反馈自动调整此参数以适应该类型材料。',
        closeBtn: '关闭'
      }
    },
    // FSRS6算法
    fsrs6Notices: {
      optimizationApplied: '优化参数已应用',
      optimizationRejected: '已拒绝优化建议，保持当前参数',
      dataRefreshed: '优化数据已刷新，复习记录: {count} 条',
      loadingData: '加载优化数据中...',
      historyTitle: '优化历史记录',
      historyCount: '{count} 条',
      colStatus: '状态',
      colTime: '优化时间',
      colPhase: '阶段',
      colReviews: '复习记录',
      colAccuracy: '准确性',
      colChanges: '参数变化',
      colNote: '备注',
      noChanges: '无变化',
      paramCount: '{count} 个参数',
      serviceNotReady: '优化服务未初始化，请稍后再试或重新加载插件',
      insufficientData: '数据量不足，需要至少50次复习记录才能优化参数，当前只有 {count} 次复习',
      optimizationFailed: '参数优化失败: ',
      statusAccepted: '已接受',
      statusRejected: '已拒绝'
    },
    // 许可证
    licenseNotices: {
      resetConfirm: '确定要重置许可证吗？这将清除当前的激活状态。',
      sectionTitle: '许可证状态',
      verifySuccess: '许可证验证成功',
      verifyFailed: '许可证验证失败',
      verifyFailedDetail: '许可证验证失败: {error}',
      resetSuccess: '许可证已重置'
    },

    // 性能优化
    virtualization: {
      title: '性能优化',
      description: '配置虚拟滚动和渲染优化，提升大量卡片时的性能表现',
      resetConfirm: '确定要重置所有虚拟化设置为默认值吗？',
      resetButton: '重置为默认',
      kanban: {
        title: '看板视图设置',
        enableVirtualScroll: {
          label: '启用虚拟滚动',
          description: '在看板列内启用虚拟滚动，大幅提升大量卡片时的性能（推荐 >200 张卡片时启用）'
        },
        enableColumnVirtualization: {
          label: '列内虚拟化',
          description: '单独对每一列启用虚拟滚动（关闭后仍可使用渐进加载）'
        },
        overscan: {
          label: '预渲染数量 (Overscan)',
          description: '视口外预渲染的卡片数量，增加可减少滚动时的白屏，但会占用更多内存'
        },
        initialBatchSize: {
          label: '初始加载数量',
          description: '每列初始加载的卡片数量（非虚拟化模式下有效）'
        },
        loadMoreBatchSize: {
          label: '批量加载数量',
          description: '点击"加载更多"时一次加载的卡片数量'
        }
      },
      table: {
        title: '表格视图设置',
        enableVirtualScroll: {
          label: '启用虚拟滚动',
          description: '在表格视图启用虚拟滚动（当前默认使用分页）'
        },
        enableTableVirtualization: {
          label: '启用表格虚拟滚动',
          description: '对表格行启用虚拟滚动（需先启用虚拟滚动）'
        },
        paginationThreshold: {
          label: '分页阈值',
          description: '少于此数量时使用分页而非虚拟滚动（推荐 500）'
        }
      },
      advanced: {
        title: '高级选项',
        cacheItemHeight: {
          label: '缓存测量高度',
          description: '缓存卡片的测量高度以提升性能（推荐开启）'
        },
        estimatedItemHeight: {
          label: '估算项目高度',
          description: '虚拟滚动的初始高度估算值（像素）'
        },
        resetSettings: {
          label: '重置设置',
          description: '将所有虚拟化设置重置为默认值'
        }
      },
      tips: {
        title: '性能优化提示',
        tip1: '虚拟滚动在卡片数量超过 200 张时自动启用，无需手动干预',
        tip2: '增加 Overscan 值可减少滚动时的白屏，但会增加内存占用',
        tip3: '表格视图推荐使用分页模式，除非需要快速浏览大量数据',
        tip4: '启用高度缓存可显著提升滚动性能，但会占用少量内存'
      }
    },
    
    // 牌组视图
    decks: {
      dashboard: {
        emptyHint: '该分类暂无牌组，创建新牌组时可为其分配分类',
        unit: '张',
        study: '学习',
        completed: '完成',
        startStudy: '开始学习',
        viewCelebration: '查看庆祝',
        moreActions: '更多操作',
        heatmapTitle: '牌组热力图',
        filterParent: '父卡片牌组',
        filterChild: '子卡片牌组',
        filterAll: '全部牌组',
        categoryRequired: '至少需要保留一个分类',
        categoryUpdated: '已更新分类',
        durationMinutes: '{n}分钟',
        durationZero: '0分钟',
      },
      card: {
        ariaLabel: '牌组: {name}',
        new: '未',
        learning: '学',
        review: '复',
        newFull: '未学',
        learningFull: '学习',
        reviewFull: '复习',
        moreActions: '更多操作',
        irUnread: '未读',
        irPending: '待读',
        irQuestions: '提问',
      },
      questionBank: {
        total: '总题',
        completed: '已练',
        errors: '错题',
        empty: '暂无题目'
      },
      grid: {
        emptyText: '该分类暂无牌组',
        emptyHint: '创建新牌组时可为其分配分类',
        parentDeck: '父卡片牌组',
        childDeck: '子卡片牌组',
        readingTitle: '增量阅读',
        readingDesc: '增量阅读功能已整合到左侧边栏',
      },
      menu: {
        advanceStudy: '提前学习',
        deckAnalytics: '牌组分析',
        createSubdeck: '创建子牌组',
        moveDeck: '移动牌组',
        moveCategory: '移动分类',
        editDeck: '牌组编辑',
        edit: '编辑',
        delete: '删除',
        refreshData: '刷新数据'
      },
      categoryFilter: {
        incrementalReading: '增量阅读',
        memory: '记忆牌组',
        questionBank: '考试牌组',
      },
      viewSwitcher: {
        table: '表格视图',
        grid: '网格视图',
        kanban: '看板视图',
      },
      progressBar: {
        ariaLabel: '{deckName}进度：新{new}张，学习中{learning}张，待复习{review}张，已掌握{mastered}张',
        empty: '暂无卡片',
      },
      timeline: {
        today: '今天',
        urgent: '紧急',
        normal: '常规',
        completed: '已完成',
        cards: '张',
        startTodayStudy: '开始今日学习',
        thisWeek: '本周',
        thisMonth: '本月',
        monthCompleted: '本月完成',
        monthNew: '本月新增',
        studyDuration: '学习时长',
        studyTimeHours: '{n} 小时',
        monthAchievements: '本月成就',
        streak: '连续学习',
        streakDays: '{n} 天',
        completionRate: '完成率',
        weekDays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      },
      knowledgeMap: {
        title: '知识体系路线图',
        subtitle: '系统化学习路径 · 从基础到专家',
        overviewTitle: '学习进度总览',
        legendCompletion: '学习完成度',
        legendMastery: '记忆掌握率',
        deckCount: '{n} 个牌组',
        changeLevel: '更改知识体系级别',
        uncategorized: '未分类',
        levelFoundation: '基础级',
        levelIntermediate: '中级',
        levelAdvanced: '高级',
        levelExpert: '专家级',
        emptyTitle: '还没有知识体系牌组',
        emptyDesc: '创建牌组时，在名称中包含"基础"、"中级"、"高级"或"专家"等关键词，系统会自动识别并组织到相应层级。',
      },
      tagGroupCreator: {
        titleCreate: '创建标签组',
        titleEdit: '编辑标签组',
        nameLabel: '标签组名称',
        namePlaceholder: '例如：循环系统、前端开发',
        tagsLabel: '包含的标签',
        tagInputPlaceholder: '输入标签后按回车添加',
        tagHint: '从现有牌组标签中选择，或输入新标签',
        tagExists: '标签已存在',
        nameRequired: '请输入标签组名称',
        tagRequired: '请至少添加一个标签',
        cancel: '取消',
        save: '保存',
        create: '创建',
      },
      statsPopover: {
        ariaLabel: '牌组统计信息',
        close: '关闭',
        closeEsc: '关闭 (Esc)',
        newCards: '新卡片',
        learning: '学习中',
        review: '待复习',
        mastered: '已掌握',
        unit: '张',
        memoryRate: '记忆率',
        todayStudy: '今日学习',
        minutes: '分钟',
        lessThan1Min: '< 1分钟',
        zeroMin: '0分钟',
      },
      kanban: {
        noTag: '无标签',
        tagGrouping: '标签分组',
        other: '其他',
        tagGroupPrefix: '标签组：{name}',
        tagGroupUpdated: '标签组"{name}"已更新',
        tagGroupCreated: '标签组"{name}"已创建',
        tagGroupDeleteConfirm: '确定要删除标签组"{name}"吗？',
        confirmDelete: '确认删除',
        tagGroupDeleted: '标签组"{name}"已删除',
        startReading: '开始阅读',
        advanceReading: '提前阅读',
        advanceReadingFailed: '提前阅读失败',
        editDeck: '牌组编辑',
        deckAnalytics: '牌组分析',
        dissolveDeck: '解散牌组',
        dissolveConfirmIR: '解散后牌组将被删除，但内容块数据会保留。确定继续？',
        deckDissolved: '牌组已解散（内容块数据已保留）',
        dissolveFailed: '解散牌组失败',
        deleteDeck: '删除牌组',
        analytics: '分析',
        qbServiceNotInit: '题库服务未初始化',
        qbNotFound: '题库不存在',
        openAnalyticsFailed: '打开分析界面失败',
        grouping: '正在分组...',
        emptyColumn: '暂无牌组',
        groupLabel: '{label}分组',
        kanbanSettings: '看板设置',
        viewOptions: '视图选项',
        groupByLabel: '分组方式',
        tagGroup: '标签组',
        selectPlaceholder: '-- 请选择 --',
        createNew: '新建',
        newTagGroup: '新建标签组',
        editTagGroup: '编辑标签组',
        deleteTagGroup: '删除标签组',
        hideEmptyGroups: '隐藏空白分组',
        groups: '群组',
        reset: '重置',
        showAll: '显示所有列',
        hideAll: '隐藏所有列',
        showAllBtn: '全部显示',
        hideAllBtn: '全部隐藏'
      }
    },
    
    //  学习信息面板
    studyInfo: {
      fsrs: {
        title: 'FSRS算法信息',
        version: 'FSRS 5/6',
        description: 'FSRS (Free Spaced Repetition Scheduler) 是一个基于记忆模型的间隔重复算法，能够更精确地预测遗忘时间并优化复习间隔。'
      },
      today: {
        title: '今日学习',
        unit: '张卡',
        studied: '已学习',
        new: '新增',
        review: '复习',
        reviewCount: '复习次数'
      },
      smartTips: {
        title: '智能提示',
        shortMemory: '智能短时记忆',
        forgetPredict: '预测遗忘优化',
        sameDayOptimize: '同日复习优化'
      },
      currentCard: {
        title: '当前卡片',
        type: '类型',
        reps: '复习次数',
        lapses: '遗忘次数'
      }
    },
    
    //  垂直工具栏
    toolbar: {
      unknownDeck: '未知牌组',
      sourceNotFound: '未找到源文档',
      sourceNotExist: '源文档不存在',
      blockNotFound: '未找到块链接',
      sourceDeleted: '源文档已被删除',
      jumpedToSource: '已跳转到源文档',
      openedSource: '已打开源文档',
      noSourceLinked: '该卡片未关联源文档',
      sourceDoc: '源文档',
      currentCard: '当前卡片',
      saveAndPreview: '保存并预览',
      editCard: '编辑卡片',
      preview: '预览',
      edit: '编辑',
      plainTextEditor: '普通文本编辑器',
      textEdit: '文本编辑',
      deleteCard: '删除卡片',
      delete: '删除',
      setReminder: '设置提醒',
      reminder: '提醒',
      setPriority: '设置优先级',
      priority: '优先级',
      changeDeck: '更换牌组',
      deck: '牌组',
      deckList: '牌组列表',
      currentDeck: '当前牌组',
      availableDecks: '可用牌组',
      viewCardInfo: '查看卡片信息与来源',
      cardInfoAndSource: '卡片信息与来源',
      belongToDeck: '所属牌组',
      cardState: '卡片状态',
      stateNew: '新',
      stateLearning: '学习中',
      stateReview: '复习中',
      stateRelearning: '重学中',
      stateUnknown: '未知',
      graphLink: '图谱联动',
      graphLinkEnabled: '关闭图谱联动',
      graphLinkDisabled: '开启图谱联动',
      graphLinkSuccess: '图谱联动已开启\n切换卡片时图谱会自动更新',
      graphLinkClosed: '图谱联动已关闭',
      noSourceFile: '当前卡片没有来源文档',
      sourceFileNotExist: '来源文档不存在',
      graphLinkInitFailed: '图谱联动初始化失败',
      blockJumpFailed: '跳转失败',
      noDecksAvailable: '没有可用的牌组',
      setCardDeck: '设置卡片所属牌组',
      noSourceDoc: '该卡片没有关联的源文档',
      sourceDocDeleted: '源文档不存在或已被删除',
      blockRefNotFound: '未找到块引用 ^{blockId}',
      readSourceFailed: '读取源文档失败',
      copiedSourceBlock: '已复制源块内容',
      openedEpub: '已打开EPUB源文档',
      studyViewNotFound: '未找到学习视图',
      avgTime: '平均用时',
      longPressDrag: '长按拖拽调整位置',
      directDeleteCard: '直接删除卡片',
      removeFromDeck: '从当前牌组移除（保留卡片数据）',
      remove: '移除',
      aiAssistant: 'AI助手',
      hasSourceDoc: '有来源文档',
      noSourceDocShort: '无来源文档',
      sourceIndicatorTip: '该卡片有来源文档，可查看局部知识图谱',
      openInfoMenu: '打开卡片详细信息和来源菜单',
      view: '查看',
      basicInfo: '基础信息',
      cardId: '卡片ID',
      cardRelation: '卡片关系',
      childCard: '子卡片',
      parentCard: '父卡片',
      independentCard: '独立卡片',
      containCards: '含 {n} 张',
      studyData: '学习数据',
      stability: '稳定性',
      difficulty: '难度',
      interval: '间隔',
      totalReviews: '总复习次数',
      timesUnit: '{n}次',
      secondsUnit: '{n}秒',
      memoryRate: '记忆成功率',
      unknown: '未知',
      formatError: '格式错误',
      lessThanOneDay: '少于1天',
      daysUnit: '{n}天',
      monthsUnit: '{n}个月',
      yearsUnit: '{n}年',
      timeInfo: '时间信息',
      createdTime: '创建时间',
      modifiedTime: '修改时间',
      nextReview: '下次复习',
      sourceInfo: '来源信息',
      noSource: '无来源',
      blockRef: '块引用',
      viewDetails: '查看详细信息',
      viewDataStructure: '查看数据结构',
      viewDataStructureTitle: '查看完整的卡片数据结构（JSON格式）',
      viewSourceBlock: '查看源块文本',
      viewSourceBlockAria: '查看源块原文',
      sourceText: '原文',
      sourceBlockTitle: '源块文本',
      loadingSourceBlock: '正在加载源块内容...',
      unknownFile: '未知文件',
      sourceBlockLabel: '源块',
      emptyContent: '（空内容）',
      jumpToSource: '跳转源文档',
      jumpToSourceTitle: '在Obsidian中打开源文档并定位到此块',
      copyContent: '复制内容',
      copyContentTitle: '复制源块内容到剪贴板',
      moreSettings: '更多设置',
      more: '更多',
      autoPlayMedia: '自动播放媒体',
      playMode: '播放模式',
      playFirst: '仅第一个',
      playAllMedia: '播放全部',
      playTiming: '播放时机',
      onCardChange: '切换卡片',
      onShowAnswer: '显示答案',
      playInterval: '播放间隔',
      cardOrder: '卡片顺序',
      sequential: '正序学习',
      random: '乱序学习',
      timeoutPause: '超时暂停',
      enableDirectDelete: '启用直接删除',
      showTutorialBtn: '显示教程按钮',
      recycleCardLabel: '回收卡片：#回收',
      recycleCardTitle: '回收当前卡片，暂时移出学习队列，等待改进',
      clickApply: '点击应用',
      viewTutorial: '查看使用教程',
      tutorial: '教程',
      tutorialTitle: '使用教程',
      moreMenu: '更多 ▾',
      tabCore: '核心特性',
      tabBasics: '基础格式',
      tabAI: 'AI助手',
      tabProgressive: '渐进式挖空',
      tabPriority: '卡片优先级',
      tabQueue: '学习队列',
    },
    
    //  模态框
    modals: {
      viewCard: {
        title: '卡片详情',
        tabInfo: '卡片基本信息',
        tabStats: '复习数据',
        tabCurve: '记忆曲线图',
        loading: '加载中...',
        unknownTemplate: '未知模板',
        noDeck: '无牌组'
      },
      moveDeck: {
        title: '移动牌组',
        moveToNew: '将 {name} 移动到新位置',
        searchPlaceholder: '搜索目标牌组...',
        selectTarget: '选择目标位置',
        rootOption: '顶级（无父牌组）',
        rootDesc: '升级为根级牌组',
        moveToRoot: '移动为顶级牌组',
        cancel: '取消',
        confirm: '确认移动'
      },
      saveFilter: {
        title: '保存筛选器',
        name: '名称',
        namePlaceholder: '请输入筛选器名称',
        nameError: '请输入筛选器名称',
        nameTooLong: '名称不能超过50个字符',
        description: '描述',
        descriptionPlaceholder: '可选',
        icon: '图标',
        color: '颜色',
        pinToSidebar: '固定到侧边栏',
        cancel: '取消',
        save: '保存',
        iconFilter: '筛选器',
        iconStar: '星标',
        iconBookmark: '书签',
        iconTag: '标签',
        iconHeart: '喜欢',
        iconFlag: '旗帜',
        iconCircleDot: '圆点',
        iconCheckCircle: '勾选',
        iconClock: '时钟',
        iconCalendar: '日历',
        iconBook: '书籍',
        iconLayers: '分层',
        colorBlue: '蓝色',
        colorTheme: '主题色',
        colorPink: '粉色',
        colorRed: '红色',
        colorOrange: '橙色',
        colorGreen: '绿色',
        colorCyan: '青色',
        colorGray: '灰色'
      },
      batchAddTags: {
        title: '批量添加标签',
        inputPlaceholder: '输入标签并按回车...',
        suggestions: '建议',
        cancel: '取消',
        confirm: '确认添加'
      },
      batchRemoveTags: {
        title: '批量删除标签',
        info: '从选中的 {count} 张卡片中删除标签',
        selectAll: '全选',
        clearAll: '清空',
        noTags: '所选卡片没有标签',
        cancel: '取消',
        confirm: '确认删除'
      },
      batchDeckChange: {
        title: '批量更换牌组',
        operationType: '选择操作类型：',
        move: '移动',
        moveDesc: '将 {count} 张卡片移动到新牌组',
        copy: '复制',
        copyDesc: '复制 {count} 张卡片到新牌组（保留原卡片）',
        searchPlaceholder: '搜索牌组...',
        selectDeck: '选择牌组: {name}',
        cancel: '取消',
        confirm: '确认'
      },
      cardInfoTab: {
        copyUUID: 'UUID已复制到剪贴板',
        noSource: '此卡片没有关联的源文档',
        sourceDeleted: '源文档已被删除',
        jumpedToSource: '已跳转到源文档',
        openedSource: '已打开源文档',
        basicInfo: '基础信息',
        uuid: 'UUID',
        deckLabel: '所属牌组',
        templateLabel: '使用模板',
        createdAt: '创建时间',
        updatedAt: '最后编辑',
        sourceInfo: '来源信息',
        sourceFile: '来源文件',
        sourceBlock: '来源块',
        notLinked: '未关联',
        viewSource: '查看源文档',
        tags: '标签',
        noTags: '暂无标签',
        customFields: '自定义字段',
        noCustomFields: '暂无自定义字段'
      },
      reviewStatsTab: {
        coreMetrics: '核心指标',
        totalReviews: '总复习次数',
        lapses: '遗忘次数',
        successRate: '正确率',
        avgResponseTime: '平均答题时间',
        times: '次',
        seconds: '秒',
        fsrsMetrics: 'FSRS指标',
        stability: '稳定性',
        difficulty: '难度',
        retrievability: '可提取性',
        days: '天',
        reviewHistory: '复习历史',
        noHistory: '暂无复习记录',
        schedulingInfo: '调度信息',
        currentInterval: '当前间隔',
        nextReview: '下次复习',
        notScheduled: '未安排'
      },
      memoryCurveTab: {
        title: '记忆曲线',
        description: '记忆曲线图显示',
        noData: '暂无数据',
        timeRange: '时间范围：',
        range7d: '7天',
        range30d: '30天',
        range90d: '90天',
        rangeAll: '全部',
        legend: {
          predicted: '预测曲线 - 基于FSRS算法的理论遗忘曲线',
          actual: '实际曲线 - 基于真实复习记录的表现',
          review: '复习点 - 实际复习时刻的记忆状态'
        },
        emptyState: {
          title: '数据不足',
          description: '至少需要2次复习记录才能生成记忆曲线',
          reviewCount: '当前复习次数：{count}'
        },
        insights: {
          title: '曲线解读',
          forgetting: {
            title: '遗忘曲线',
            description: '记忆随时间自然衰退，稳定性越高，曲线越平缓'
          },
          optimalTiming: {
            title: '最佳复习时机',
            description: '当可提取性降至70-80%时复习效果最佳'
          },
          stabilityGrowth: {
            title: '稳定性增长',
            description: '成功复习会显著提升稳定性，延长下次间隔'
          },
          lapsesImpact: {
            title: '遗忘影响',
            description: '遗忘会降低稳定性，但有助于长期记忆'
          }
        },
        summary: {
          dataPoints: '数据点数量',
          reviewMarkers: '复习标记',
          currentStability: '当前稳定性',
          currentRetrievability: '当前可提取性',
          pointsUnit: '个',
          daysUnit: '天'
        }
      },
      apkgImport: {
        title: 'APKG导入',
        selectFile: '请选择 .apkg 文件',
        invalidFile: '请选择 .apkg 文件',
        importing: '导入中...',
        importComplete: '导入完成',
        importFailed: '导入失败',
        stages: {
          parsing: '解析文件',
          media: '导入媒体',
          cards: '导入卡片',
          finalizing: '完成'
        }
      },
      fileSelector: {
        title: '选择文件',
        rootFolder: '根目录',
        selectAll: '全选',
        deselectAll: '取消全选',
        selected: '已选择 {count} 个文件',
        confirm: '确认',
        cancel: '取消'
      },
      cardPreview: {
        title: '卡片预览',
        back: '返回',
        close: '关闭',
        selectCard: '选择此卡片',
        modifyRequirement: '修改生成要求',
        collapseDialog: '收起对话',
        prevCard: '上一张',
        nextCard: '下一张',
        selectAll: '全选',
        deselectAll: '取消全选',
        selected: '已选择',
        cardsUnit: '张',
        importTo: '导入到',
        importCards: '导入 {count} 张卡片',
        importing: '导入中...',
        generating: '正在生成',
        generatingProgress: '正在生成 {current}/{total}'
      },
      aiConfig: {
        title: 'AI制卡配置',
        tabs: {
          cardSettings: '卡片设置',
          prompts: '提示词',
          aiSettings: 'AI配置'
        },
        generation: {
          cardCount: '生成数量',
          difficulty: '难度级别',
          basic: '基础',
          intermediate: '进阶',
          advanced: '高级'
        },
        types: {
          title: '题型分布',
          qa: '问答题',
          choice: '选择题',
          fill: '填空题',
          cloze: '挖空题'
        }
      },
      batchTemplateChange: {
        title: '批量更换模板',
        selectTemplate: '选择新模板',
        confirm: '确认更换',
        cancel: '取消'
      },
      createDeck: {
        titleCreate: '新建牌组',
        titleEdit: '编辑牌组',
        titleCreateSub: '新建子牌组',
        parentDeck: '父牌组（可选）',
        noParent: '无（创建根牌组）',
        willCreateAs: '将创建为「{parent}」的子牌组',
        name: '名称',
        namePlaceholder: '例如：计算机科学',
        description: '描述',
        descriptionPlaceholder: '可选',
        category: '分类（可多选）',
        categoryLoading: '加载分类中...',
        categorySelected: '已选择 {count} 个分类',
        categoryDisabled: '子牌组不支持分类，跟随父牌组的分类',
        deckType: '牌组类型',
        deckTypeMixed: '混合题型',
        deckTypeMixedDesc: '可以添加所有类型的卡片',
        deckTypeChoice: '选择题专用',
        deckTypeChoiceDesc: '只能添加选择题类型的卡片',
        deckTypeHint: '此牌组只能添加选择题类型的卡片',
        cancel: '取消',
        create: '创建',
        save: '保存',
        close: '关闭',
        initFailed: '初始化失败，请重试',
        createFailed: '创建牌组失败: {error}',
        tagLabel: '牌组标签（单选）',
        removeTag: '移除标签',
        tagPlaceholder: '输入标签后按回车添加',
        availableTags: '可选标签（点击选择）',
        tagHint: '标签用于牌组分类，仅可选择一个标签'
      }
    },
    
    //  命令
    commands: {
      formatAsCloze: {
        name: '格式化为渐进式挖空',
        noSelection: '请先选中要格式化的文本',
        success: '已格式化为渐进式挖空，请输入序号（如 1, 2, 3）',
        error: '格式化失败，请重试'
      }
    },
    
    //  关于页面
    about: {
      title: '关于Weave',
      product: {
        name: 'Weave - 阅读摘录、卡片记忆、考试测试插件',
        productName: '产品名称',
        version: '版本号',
        versionLabel: '版本',
        algorithm: '核心算法',
        algorithmValue: '增量阅读（TVP-DS）记忆牌组（FSRS6）考试测试（EWMA）',
        platform: '适用平台',
        platformValue: 'Obsidian',
        developer: '开发者',
        developerValue: 'Rabbit',
        licenseMode: '许可模式',
        licenseModeValue: '完全免费 + 高级功能许可证',
        description: '完全服务于obsidian的阅读摘录，卡片记忆，考试测试的插件'
      },
      quickLinks: {
        title: '快捷链接',
        openSource: '部分开源',
        documentation: '查看教程（编写中）',
        changelog: '更新日志',
        support: '联系支持'
      },
      acknowledgments: {
        title: '特别鸣谢',
        fsrs: 'FSRS算法',
        fsrsDesc: 'FSRS算法团队',
        obsidian: 'Obsidian',
        obsidianDesc: 'Obsidian平台支持',
        anki: 'Anki',
        ankiDesc: 'Anki项目启发',
        community: 'SamuelKreatorsz',
        communityDesc: '社区贡献者'
      },
      license: {
        title: '许可证信息',
        status: '状态',
        statusActive: '高级功能已激活',
        statusInactive: '高级功能未激活',
        type: '类型',
        manage: '管理',
        activation: {
          title: '许可证激活',
          code: '激活码',
          placeholder: '输入许可证激活码',
          activate: '激活',
          activating: '激活中...',
          formTitle: '许可证激活',
          formDesc: '输入激活码和邮箱以解锁高级功能',
          licensed: '许可证已激活',
          activatedAt: '激活时间: ',
          licenseType: '许可证类型: ',
          lifetime: '终身许可',
          subscription: '订阅许可',
          boundEmail: '绑定邮箱: ',
          activatedDevices: '已激活设备: ',
          codeLabel: '激活码',
          collapseCode: '收起',
          viewCode: '查看激活码',
          copyCode: '复制激活码',
          codeCopied: '激活码已复制到剪贴板',
          copyFailed: '复制失败，请手动复制',
          deactivate: '移除激活',
          confirmDeactivate: '确定要移除激活状态吗？移除后需要重新激活才能使用高级功能。',
          confirmDeactivateTitle: '确认移除激活',
          deactivated: '激活状态已移除',
          deactivateFailed: '移除激活状态失败',
          deactivateError: '移除激活状态时发生错误',
          codeHint: '请粘贴完整的激活码',
          validating: '验证中...',
          formatValid: '格式正确',
          formatInvalid: '格式错误',
          clearInput: '清除输入',
          clear: '清除',
          chars: '字符',
          lengthInvalid: '长度不符合要求',
          formatIncorrect: '格式不正确',
          emailLabel: '邮箱地址',
          emailHint: '此邮箱将绑定到激活码',
          emailPlaceholder: '请输入您的邮箱',
          emailValid: '邮箱格式正确',
          emailInvalid: '请输入有效的邮箱地址',
          confirmEmail: '确认邮箱',
          confirmEmailHint: '请再次输入邮箱',
          emailMatch: '邮箱匹配',
          emailMismatch: '两次输入的邮箱不一致',
          activateLicense: '激活许可证',
          hideHelp: '隐藏帮助',
          showHelp: '显示帮助',
          helpFormatTitle: '激活码格式说明',
          helpInputTitle: '输入提示',
          helpTroubleshootTitle: '故障排除',
          helpContactTitle: '联系支持',
          helpContactMsg: '如需帮助，请联系：',
          errorTitle: '激活失败',
          remainingAttempts: '剩余尝试次数：{count}',
          successTitle: '激活成功',
          successMsg: '许可证已成功激活，高级功能已启用',
          deviceReplaced: '由于设备数量已满，已自动移除最久未使用的设备',
          tooManyAttempts: '激活尝试次数过多',
          activationFailed: '激活失败',
          unknownError: '激活过程中发生未知错误'
        },
        statusCard: {
          activated: '许可证已激活',
          notActivated: '许可证未激活',
          unknown: '未知',
          lifetimeBuyout: '永久买断',
          subscriptionLicense: '订阅许可',
          license: '许可证',
          licenseType: '许可证类型',
          lifetimeValid: '永久有效',
          activatedAt: '激活时间',
          expiresAt: '到期时间',
          productVersion: '产品版本',
          expired: '已过期',
          daysUntilExpiry: '{days}天后过期',
          longTermValid: '长期有效',
          verifyLicense: '验证许可证',
          resetLicense: '重置许可证',
          inactiveMsg: '当前仅可使用免费功能，激活许可证后可解锁所有高级功能。'
        }
      },
      contact: {
        title: '联系方式',
        github: 'GitHub仓库',
        email: '联系邮箱',
        support: '技术支持',
        website: '官方网站'
      }
    },
    
    //  设置常量
    settingsConstants: {
      linkPath: {
        short: '最短路径（文件名）',
        relative: '相对路径',
        absolute: '绝对路径'
      },
      modalSize: {
        small: '小 (600\u00d7400)',
        medium: '中 (700\u00d7500)',
        large: '大 (800\u00d7600)',
        extraLarge: '超大 (1000\u00d7700)',
        custom: '自定义'
      },
      productInfo: {
        name: 'Weave - 阅读摘录、卡片记忆、考试测试插件',
        algorithm: '增量阅读（TVP-DS） 记忆牌组（FSRS6） 考试测试（EWMA）',
        licenseModel: '免费插件 + 高级功能许可证'
      },
      contactInfo: {
        supportSubject: 'Weave插件许可证购买咨询'
      },
      features: {
        free: [
          '基础间隔重复学习',
          'FSRS6 智能算法',
          '卡片创建和编辑',
          '学习进度跟踪',
          '数据本地存储',
          '基础统计分析'
        ],
        premium: [
          '高级学习模式',
          '详细数据分析',
          'AI 批量制卡（开发中）',
          '考试模式（开发中）'
        ]
      },
      devStatus: {
        stable: '稳定',
        beta: '测试版',
        alpha: '内测版',
        development: '开发中',
        planned: '计划中'
      },
      aiProviderLabels: {
        zhipu: '智谱清言',
        siliconflow: '硅基流动'
      },
      aiProviderDesc: {
        openai: 'OpenAI官方API',
        gemini: 'Google AI，有免费额度',
        anthropic: 'Claude系列，代码和长文本能力突出',
        deepseek: 'OpenAI兼容接口，高性价比',
        zhipu: '国产模型，有免费额度，国内直连',
        siliconflow: '模型聚合平台，多种开源模型可选',
        xai: 'Grok系列，OpenAI兼容接口'
      },
      aiKeyPlaceholder: {
        zhipu: '输入API密钥'
      },
      acknowledgments: {
        fsrs: { name: 'FSRS算法', description: '科学的间隔重复算法' },
        obsidian: { name: 'Obsidian', description: '优秀的知识管理平台' },
        anki: { name: 'Anki', description: '间隔重复学习先驱' },
        samdagreatwzzz: { name: 'SamdaGreatzzz', description: 'AI制卡设计灵感' }
      },
      promptTemplates: {
        standardQa: { name: '标准问答生成', description: '适用于一般性学习材料，生成标准问答卡片，包含多种题型', prompt: '请根据以下内容生成{count}张问答卡片，难度为{difficulty}。要求问题简洁明确，答案完整准确。' },
        conceptExplain: { name: '概念解释型', description: '专注于概念理解，生成定义类、解释类卡片', prompt: '请提取关键概念并生成解释型卡片，包含定义、特点、应用场景。' },
        deepUnderstanding: { name: '深度理解型', description: '生成高阶思维卡片，强调理解和应用', prompt: '生成需要深度思考的卡片，重点考察理解、分析、应用能力。避免简单记忆型问题。' },
        clozeFill: { name: '挖空填充型', description: '专注于生成挖空题，适合记忆关键术语和概念', prompt: '生成挖空题，使用{{c1::}}语法标记关键词。每张卡片1-3个挖空点。' }
      }
    },
    //  设置工具函数
    settingsUtils: {
      operationFailed: '操作失败',
      licenseStatus: {
        inactive: '未激活',
        expired: '已过期',
        expiringIn: '{days}天后过期',
        active: '已激活'
      },
      validation: {
        codeEmpty: '激活码不能为空',
        codeTooShort: '激活码长度不足，至少需要 {min} 个字符',
        codeInvalidChars: '激活码包含无效字符，只允许字母、数字、连字符和点号',
        codeIncomplete: '激活码可能不完整，请确保复制了完整的激活码'
      },
      errors: {
        invalidFormat: '激活码格式不正确',
        invalidFormatSolution: '请确保完整复制激活码，包括所有字符和点号分隔符',
        codeExpired: '激活码已过期',
        codeExpiredSolution: '请联系客服获取新的激活码',
        deviceLimit: '设备绑定数量已达上限',
        deviceLimitSolution: '请在其他设备上解绑后重试，或联系客服增加设备数量',
        networkFailed: '无法连接到激活服务器',
        networkFailedSolution: '请检查网络连接，或稍后重试',
        serverError: '激活服务器暂时不可用',
        serverErrorSolution: '请稍后重试，如问题持续请联系客服'
      }
    },
    //  许可证激活
    license: {
      boundEmail: '绑定邮箱',
      activatedDevices: '已激活设备',
      activationPrompt: '激活后解锁更多强大功能',
      getActivationCode: '获取激活码',
      activatePremium: '激活高级功能'
    },
    study: {
      title: '学习',
      session: {
        start: '开始学习',
        pause: '暂停',
        resume: '继续',
        finish: '结束',
        exit: '退出'
      },
      progress: {
        new: '新',
        learning: '学习中',
        review: '复习',
        completed: '已完成',
        remaining: '剩余'
      },
      rating: {
        again: '重来',
        hard: '困难',
        good: '良好',
        easy: '简单',
        showAnswer: '显示答案'
      },
      toolbar: {
        undo: '撤销',
        skip: '跳过',
        edit: '编辑',
        flag: '标记',
        suspend: '暂停',
        bury: '搁置',
        delete: '删除',
        info: '信息',
        source: '来源'
      },
      stats: {
        studyTime: '学习时间',
        cardsReviewed: '已复习卡片',
        accuracy: '正确率',
        streak: '连续'
      },
      header: {
        defaultTitle: '学习',
        multiDeckBadge: '此卡片被多个牌组引用: {decks}',
        dotReading: '增量阅读',
        dotMemory: '记忆牌组',
        dotExam: '考试牌组',
        expandSourceInfo: '展开来源信息',
        collapseSourceInfo: '收起来源信息',
        expandStats: '展开统计',
        collapseStats: '收起统计',
        hideSidebar: '隐藏侧边栏',
        showSidebar: '显示侧边栏',
        close: '关闭',
      },
      childCards: {
        regenerating: '正在重新生成...',
      },
      cloze: {
        revealedContent: '已显示内容: {content}',
        hiddenContent: '隐藏内容，点击显示答案',
        clickToReveal: '点击显示答案',
      },
      choiceAccuracy: {
        label: '正确率',
        tooltipTitle: '选择题正确率',
        correct: '答对',
        rating: '评价',
        excellent: '优秀',
        good: '良好',
        pass: '及格',
        needsWork: '需努力',
      },
      kanban: {
        groupBy: {
          status: '学习状态',
          type: '题型',
          priority: '优先级',
          deck: '牌组',
          createTime: '创建时间',
          tag: '标签',
        },
        sort: {
          created: '创建时间',
          due: '到期时间',
          modified: '修改时间',
          priority: '优先级',
          difficulty: '难度',
          title: '标题',
          asc: '升序',
          desc: '降序',
        },
        groupTitle: {
          byStatus: '按学习状态分组',
          byType: '按题型分组',
          byPriority: '按优先级分组',
          byDeck: '按牌组分组',
          byCreateTime: '按创建时间分组',
          byTag: '按标签分组',
        },
        status: {
          new: '新卡片',
          learning: '学习中',
          review: '复习',
          relearning: '重新学习',
        },
        type: {
          qa: '问答题',
          choice: '选择题',
          cloze: '挖空题',
        },
        priorityLevel: {
          high: '高优先级',
          medium: '中优先级',
          low: '低优先级',
          none: '无优先级',
        },
        time: {
          today: '今天',
          yesterday: '昨天',
          last7days: '过去7天',
          last30days: '过去30天',
          earlier: '更早',
        },
        menu: {
          viewOptions: '视图选项',
          groupByLabel: '分组方式',
          sortLabel: '排序',
          sortRulesCount: '{n} 条规则',
          noSort: '无',
          hideEmptyGroups: '隐藏空白分组',
          toggleHideEmpty: '切换隐藏空白分组',
          fillColumnBg: '填充列背景颜色',
          toggleFillColumnBg: '切换填充列背景颜色',
          groups: '群组',
          reset: '重置',
          showAll: '全部显示',
          hideAll: '全部隐藏',
          showAllColumns: '显示所有列',
          hideAllColumns: '隐藏所有列',
          showColumn: '显示列',
          hideColumn: '隐藏列',
          addSortRule: '添加排序规则',
          clearAllSorts: '清除所有排序',
          deleteSortRule: '删除排序规则',
          selectProperty: '选择属性',
        },
        cards: {
          cardsUnit: '张卡片',
          selectAll: '全选此分组',
          due: '到期',
          selected: '已选',
          loadMore: '加载更多 ({n} 张剩余)',
          ariaGroup: '{label}分组',
        },
        drag: {
          statusRestriction: '学习状态由FSRS6算法自动管理，无法手动修改。\n请通过学习功能来更新卡片状态。',
          typeRestriction: '卡片类型无法通过拖拽修改',
          timeRestriction: '创建时间无法修改',
          noDeckRestriction: '卡片必须属于一个牌组，无法移动到"无牌组"',
        },
      },
      viewWrapper: {
        loading: '加载学习卡片中...',
        loadingDeckName: '加载中...',
        unknownDeck: '未知牌组',
        advanceNeedsDeck: '提前学习需要选择牌组',
        noExamBank: '暂无该记忆牌组对应的考试牌组',
        examNotEnabled: '题库功能未启用',
        examFailed: '开始考试失败',
      },
      unifiedActions: {
        selectDeck: '选择牌组...',
        importToDeck: '导入到记忆牌组：',
        regeneratingWait: '正在重新生成，请稍候...',
        selectTargetDeck: '请先选择目标牌组',
      },
      sidebar: {
        studyStats: '学习统计',
        completedToday: '今日完成',
        remainingCards: '剩余卡片',
        studyProgress: '学习进度',
        cardsUnit: '张',
        sourceNote: '来源笔记',
        openSourceNote: '点击打开源笔记',
        unknownNote: '未知笔记',
        cardRelation: '卡片关联',
        cardRelationSub: '(管理|图谱)',
        noCard: '当前没有卡片',
        knowledgeGraph: '知识图谱',
        viewNoteGraph: '查看笔记图谱',
        studySettings: '学习设置',
        reviewMode: '复习模式',
        sequential: '顺序',
        autoPlay: '自动播放',
        off: '关闭',
        showRelation: '显示关联',
        on: '开启',
      },
      editor: {
        updateFailed: '更新编辑器内容失败',
        sessionCreateFailed: '编辑器会话创建失败',
        editorCreateFailed: '编辑器创建失败',
        enterEditFailed: '进入编辑模式失败',
        cardSaved: '卡片已保存',
        saveFailed: '保存失败: {error}',
        unknownError: '未知错误',
        placeholder: '在此编辑卡片内容...',
        cancel: '取消',
        save: '保存',
      },
      actionTypeTab: {
        aiFormat: 'AI格式化',
        aiSplit: 'AI拆分',
      },
      formatPreview: {
        title: 'AI格式化预览 - {name}',
        originalContent: '原始内容',
        noContent: '(无内容)',
        formattedContent: '格式化后',
        unknownError: '未知错误',
        cancel: '取消',
        apply: '应用更改',
      },
      cardPreview: {
        ariaLabel: '卡片预览',
        typeQA: 'Q&A 卡片',
        typeCloze: '挖空卡片',
        typeBasic: '基础卡片',
        clozeCounter: '{revealed}/{total} 已显示',
        hintShowAnswer: '空格键: 显示答案',
        hintToggleCloze: 'H: 切换挖空',
        answerDivider: '答案解析',
        hideClozeAnswers: '隐藏挖空答案',
        showClozeAnswers: '显示挖空答案',
        noClozeMarks: '未检测到挖空标记',
        hideAnswers: '隐藏答案',
        showAnswers: '显示答案 ({revealed}/{total})',
        hideBack: '隐藏背面',
        showBack: '显示背面',
        noInteractiveContent: '无交互内容',
        metaSource: '来源: {text}',
        metaParseMethod: '解析方式: {method}',
        metaConfidence: '置信度: {value}%',
      },
      sourceInfo: {
        sourceDoc: '来源文档',
        siblingCards: '同源卡片',
        thisSession: '本次学习',
        unitCards: '张',
      },
      learningSteps: {
        minutes: '{n}分',
        completed: '完成',
        currentStep: '当前步骤',
        stepN: '第{n}步',
        nextAppear: '下次出现',
        minutesLater: '{n}分钟后',
        nextStep: '下一步骤',
        repeated: '已重复',
        repeatedTimes: '{n}次',
      },
      difficultyIndicator: {
        easy: '简单',
        medium: '中等',
        hard: '困难',
        veryHard: '超难',
        level: '难度等级',
        consecutiveHard: '连续困难',
        consecutiveHardTimes: '{n}次',
        suggestion: '建议',
        improveSuggestion: '改进此卡片',
        trendRising: '难度上升',
        trendFalling: '难度下降',
        interventionNotice: '建议改进此卡片',
        consecutiveInfo: '连续 {n} 次评为困难',
      },
      statsCards: {
        retention: '记忆保留率',
        retentionTooltip: '保留率',
        stability: '记忆稳定性',
        stabilityTooltip: '稳定性',
        difficulty: '卡片难度',
        difficultyTooltip: '难度',
        nextReview: '下次复习',
        nextReviewTooltip: '下次复习',
        unitDays: '天',
        unknown: '未知',
        today: '今日',
        daysLater: '天后',
        nDaysLater: '{n}天后',
        diffEasy: '简单',
        diffMedium: '中等',
        diffHard: '困难',
        diffVeryHard: '极难',
        stabUnstable: '不稳定',
        stabSomewhat: '较稳定',
        stabStable: '稳定',
      },
    }
  },
  
  'en-US': {
    analytics: {
      dashboard: {
        title: 'Deck Analytics',
        loading: 'Loading data...',
        error: 'Data loading failed',
        retry: 'Retry',
        refresh: 'Refresh',
        noData: 'No data available',
        
        kpi: {
          todayReviews: 'Today Reviews',
          todayNew: 'Today New',
          accuracy: 'Accuracy',
          studyTime: 'Study Time',
          memoryRate: 'Memory Rate',
          streakDays: 'Streak Days',
          fsrsProgress: 'FSRS Progress',
          
          trend: {
            up: 'Up',
            down: 'Down',
            stable: 'Stable',
            yesterdayCompare: 'vs Yesterday',
            newCardsAdded: 'New cards added'
          }
        },
        
        charts: {
          reviewTrend: 'Review Trend ({days} days)',
          ratingDistribution: 'Rating Distribution',
          calendarHeatmap: 'Calendar Heatmap',
          timeHeatmap: 'Time Heatmap (24h×7)',
          intervalGrowth: 'Interval Growth (Weekly Avg)',
          deckComparison: 'Deck Comparison'
        },
        
        table: {
          deck: 'Deck',
          reviews: 'Reviews',
          accuracy: 'Accuracy',
          avgInterval: 'Avg Interval',
          avgDifficulty: 'Avg Difficulty'
        },
        
        fsrs: {
          title: 'FSRS6 Algorithm Analysis',
          avgDifficulty: 'Avg Difficulty',
          avgStability: 'Avg Stability',
          difficultyScore: 'FSRS Difficulty Score',
          stabilityDays: 'Days',
          retentionRate: 'Retention Rate',
          learningEfficiency: 'Learning Efficiency'
        }
      },
      
      timeRange: {
        last7Days: 'Last 7 Days',
        last30Days: 'Last 30 Days',
        last90Days: 'Last 90 Days',
        thisMonth: 'This Month',
        lastMonth: 'Last Month',
        thisYear: 'This Year',
        custom: 'Custom'
      },
      
      errors: {
        loadFailed: 'Failed to load data',
        networkError: 'Network connection error',
        dataCorrupted: 'Data corrupted',
        insufficientData: 'Insufficient data',
        calculationError: 'Calculation error'
      }
    },
    
    settings: {
      title: 'Settings',
      categories: {
        basic: 'Basic',
        memoryLearning: 'Memory Learning',
        fsrs6: 'FSRS6 Algorithm',
        cardParsing: 'Batch Parsing',
        aiConfig: 'AI Card Creation',
        incrementalReading: 'Incremental Reading',
        virtualization: 'Performance',
        dataManagement: 'Data Management',
        ankiConnect: 'Anki Sync',
        about: 'About'
      },
      basic: {
        title: 'Basic Settings',
        language: {
          label: 'Language',
          chinese: '简体中文',
          english: 'English',
          description: 'Select interface language'
        },
        defaultDeck: {
          label: 'Default Deck',
          placeholder: 'Enter default deck name',
          description: 'New cards will be added to this deck by default'
        },
        notifications: {
          label: 'Enable Notifications',
          description: 'Show study reminders and system notifications'
        },
        floatingButton: {
          label: 'Show Floating Create Button',
          description: 'Display quick create button at bottom-right corner'
        },
        shortcuts: {
          label: 'Enable Keyboard Shortcuts',
          description: 'Keyboard shortcuts for study mode (1-4 for rating, Space to show answer)'
        },
        debugMode: {
          label: 'Debug Mode',
          description: 'Output detailed debug logs to browser console',
          enabled: 'Debug mode enabled, detailed logs will be shown in console',
          disabled: 'Debug mode disabled'
        },
        showPerformanceSettings: {
          label: 'Performance Settings',
          description: 'Show or hide performance optimization settings',
          shownMessage: 'Performance settings displayed',
          hiddenMessage: 'Performance settings hidden'
        },
        deckCardStyle: {
          label: 'Deck Card Style',
          description: 'Choose the visual style for deck cards in the study interface',
          options: {
            default: 'Default Style',
            chineseElegant: 'Elegant Style'
          },
          updateMessage: 'Deck card style updated'
        },
        premiumFeaturesPreview: {
          label: 'Show Premium Features Preview'
        },
        mainInterfaceOpenLocation: {
          label: 'Main Interface Location',
          content: 'Content Area (Main Editor)',
          sidebar: 'Sidebar'
        },
        studyViewSpacing: {
          label: 'Study View Spacing',
          compact: 'Compact',
          default: 'Default',
          comfortable: 'Comfortable'
        },
        progressiveCloze: {
          title: 'Progressive Cloze',
          historyInheritance: {
            label: 'History Inheritance',
            description: 'How to handle existing learning history when converting to progressive cloze',
            first: 'First sub-cloze inherits (Recommended)',
            proportional: 'All sub-clozes inherit proportionally',
            reset: 'Reset all to new cards',
            prompt: 'Prompt me each time'
          },
          updateMessage: 'Progressive cloze history inheritance strategy updated'
        }
      },
      memoryLearning: {
        learningSteps: {
          label: 'Learning Steps (minutes)',
          helpText: 'Separate multiple intervals with spaces'
        },
        graduatingInterval: {
          label: 'Graduating Interval (days)',
          unit: 'days'
        },
        maxAdvanceDays: {
          label: 'Max Advance Study Days',
          unit: 'days'
        }
      },
      editor: {
        title: 'Editor Settings',
        description: 'Configure card editor and link format',
        editorMode: {
          label: 'Editor Mode',
          markdownMode: 'Markdown Mode',
          description: 'Use unified Markdown format for card editing'
        },
        linkStyle: {
          label: 'Link Style'
        },
        linkPath: {
          label: 'Link Path'
        },
        preferAlias: {
          label: 'Prefer Alias'
        },
        attachmentDir: {
          label: 'Attachment Directory'
        },
        embedImages: {
          label: 'Auto Embed Images'
        },
        linkPathDisplay: {
          short: 'Short',
          relative: 'Relative',
          absolute: 'Absolute'
        },
        window: {
          title: 'Editor Window Settings',
          enableResize: {
            label: 'Enable Drag to Resize',
            description: 'Allow resizing editor window by dragging borders'
          },
          windowSize: {
            label: 'Window Size',
            description: 'Default size for editor window'
          },
          rememberSize: {
            label: 'Remember Last Size',
            description: 'Restore previous window size on next open'
          },
          sizePresets: {
            small: 'Small',
            medium: 'Medium',
            large: 'Large',
            fullscreen: 'Fullscreen',
            custom: 'Custom'
          }
        }
      },
      learning: {
        title: 'Learning Settings',
        reviewsPerDay: {
          label: 'Reviews Per Day',
          description: 'Maximum number of cards to review per day'
        },
        newCardsPerDay: {
          label: 'New Cards Per Day',
          description: 'Maximum number of new cards to learn per day'
        },
        learningSteps: {
          label: 'Learning Steps (minutes)',
          description: 'Separate multiple intervals with commas',
          placeholder: '1, 10'
        },
        graduatingInterval: {
          label: 'Graduating Interval (days)',
          description: 'Initial review interval after graduating from learning',
          placeholder: '1'
        },
        autoAdvance: {
          label: 'Auto Advance',
          description: 'Automatically show next card after rating',
          delay: 'Delay (seconds)'
        }
      },
      siblingDispersion: {
        title: 'Intelligent Sibling Dispersion',
        saved: 'Sibling dispersion settings saved',
        saveFailed: 'Failed to save, please try again',
        enabledNotice: 'Intelligent sibling dispersion enabled',
        resetToDefaults: 'Reset to recommended configuration',
        whatIs: 'What is Sibling Dispersion?',
        description: 'Progressive cloze creates multiple child cards (siblings) for one card. To avoid memory interference, these sibling cards should not appear on similar dates.',
        benefit: 'When enabled, it improves learning effectiveness by reducing proactive and retroactive interference, based on cognitive science research and Anki best practices.',
        enable: {
          label: 'Enable Intelligent Dispersion',
          description: 'Automatically manage sibling card study dates to avoid appearing in the same study session or on similar dates'
        },
        parameters: {
          title: 'Core Parameters'
        },
        minSpacing: {
          label: 'Minimum Spacing (Days)',
          description: 'Minimum time interval between sibling cards (Recommended: 5 days)'
        },
        spacingPercentage: {
          label: 'Dynamic Spacing Percentage',
          description: 'Dynamic adjustment ratio based on review interval (Recommended: 5%)',
          hint: 'Actual interval = max(min spacing, review interval × this ratio)'
        },
        example: {
          title: 'Dispersion Effect Examples'
        },
        features: {
          title: 'Feature Toggles'
        },
        filterInQueue: {
          label: 'Filter in Queue Generation',
          description: 'Prevent sibling cards from appearing in the same study session (Immediate effect)',
          recommendation: 'Highly recommended'
        },
        autoAdjustAfterReview: {
          label: 'Dynamic Adjustment After Review',
          description: 'Automatically adjust conflicting sibling card due dates after review',
          recommendation: 'Recommended for continuous optimization'
        },
        respectFuzzRange: {
          label: 'Respect FSRS Fuzz Range',
          description: 'Adjust only within FSRS fuzz range, preserving optimal review intervals',
          recommendation: 'Must enable for scientific accuracy'
        },
        resetButton: 'Reset to Recommended Configuration',
        resetHint: 'Based on Anki community standards and CleverDeck best practices',
        science: {
          title: 'Scientific Basis',
          interference: {
            title: 'Memory Interference Theory',
            proactive: 'Proactive Interference',
            proactiveDesc: 'Previously learned content interferes with new learning',
            retroactive: 'Retroactive Interference',
            retroactiveDesc: 'Newly learned content interferes with previous memory',
            consolidation: 'Memory Consolidation',
            consolidationDesc: 'New memories need time to consolidate; learning similar content consecutively reduces effectiveness'
          },
          references: {
            title: 'Reference Standards'
          },
          benefits: {
            title: 'Expected Benefits',
            retention: 'Improve long-term retention',
            interference: 'Reduce memory interference',
            efficiency: 'Enhance learning efficiency',
            fsrs: 'Perfect compatibility with FSRS algorithm'
          }
        }
      },
      navigation: {
        title: 'Navigation Visibility',
        description: 'Control the display of main interface navigation items'
      },
      cardParsing: {
        title: 'Batch Parsing Configuration',
        premiumPrompt: 'Batch parsing allows you to process multiple files or folders at once. Upgrade to premium to unlock this feature.',
        regexManagement: {
          title: 'Regex Pattern Management',
          addMapping: 'Add Mapping',
          presets: {
            defaultMode: 'Default Mode (New Users)',
            qaMode: 'Q&A Mode',
            standardDivider: 'Standard Divider Mode',
            basicMode: 'Basic Mode',
            ankiExport: 'Anki Export Mode'
          },
          tableHeaders: {
            type: 'Type',
            path: 'Path',
            filePrefix: 'File Prefix',
            regexPattern: 'Regex Pattern',
            targetDeck: 'Target Deck',
            subfolders: 'Subfolders',
            outerCover: 'Outer Cover',
            enabled: 'Enabled',
            actions: 'Actions'
          },
          actions: {
            enable: 'Enable',
            delete: 'Delete',
            edit: 'Edit'
          }
        },
        preset: {
          title: 'Edit Regex Preset',
          presetName: 'Preset Name',
          parseMode: 'Parse Mode',
          cardSeparation: 'Card Separation Method',
          useCustomSeparator: 'Use Custom Separator',
          useLineSeparator: 'Use Line Separator',
          cardSeparator: 'Card Separator',
          frontBackSeparator: 'Front/Back Separator',
          syncMethod: 'Sync Method',
          excludeTags: 'Exclude Tags (comma-separated)',
          parseModeOptions: {
            divider: 'Divider Mode (Simple)'
          }
        },
        dividerConfig: {
          title: 'Batch Parsing Exclude Tags',
          regex: 'Front/Back Delimiter',
          regexDesc: 'Symbol to separate front and back content of cards (default: ---div---)',
          marker: 'Cloze Marker',
          markerDesc: 'Symbol to mark cloze content (default: == ==)',
          cardSeparator: 'Card Separator',
          cardSeparatorDesc: 'Symbol to separate different cards in batch parsing (default: %%<->%%)'
        },
        systemExcludeTags: {
          label: 'File-level Exclude Tags',
          value: '#we_已删除, #we_deleted',
          desc: 'System automatically filters card files with these tags (Official setting, read-only)'
        },
        excludeTags: {
          title: 'Exclude Tags Configuration',
          label: 'User-defined Exclude Tags',
          desc: 'Cards with these tags will be skipped (separate with commas, # symbol auto-handled)',
          placeholder: 'skip'
        },
        fileMappings: {
          title: 'Folder-Deck Mapping',
          folderDeckMapping: 'Folder-Deck Mapping',
          desc: 'Configure automatic mapping between folders and decks',
          addMapping: 'Add Mapping'
        }
      },
      actions: {
        save: 'Save',
        saved: 'Settings saved',
        saveFailed: 'Failed to save settings',
        reset: 'Reset',
        cancel: 'Cancel',
        confirm: 'Confirm',
        close: 'Close'
      }
    },
    
    study: {
      title: 'Study',
      session: {
        start: 'Start Study',
        pause: 'Pause',
        resume: 'Resume',
        finish: 'Finish',
        exit: 'Exit'
      },
      progress: {
        new: 'New',
        learning: 'Learning',
        review: 'Review',
        completed: 'Completed',
        remaining: 'Remaining'
      },
      rating: {
        again: 'Again',
        hard: 'Hard',
        good: 'Good',
        easy: 'Easy',
        showAnswer: 'Show Answer'
      },
      toolbar: {
        undo: 'Undo',
        skip: 'Skip',
        edit: 'Edit',
        flag: 'Flag',
        suspend: 'Suspend',
        bury: 'Bury',
        delete: 'Delete',
        info: 'Info',
        source: 'Source'
      },
      stats: {
        studyTime: 'Study Time',
        cardsReviewed: 'Cards Reviewed',
        accuracy: 'Accuracy',
        streak: 'Streak'
      },
      header: {
        defaultTitle: 'Study',
        multiDeckBadge: 'This card is referenced by multiple decks: {decks}',
        dotReading: 'Incremental Reading',
        dotMemory: 'Memory Decks',
        dotExam: 'Exam Decks',
        expandSourceInfo: 'Expand source info',
        collapseSourceInfo: 'Collapse source info',
        expandStats: 'Expand stats',
        collapseStats: 'Collapse stats',
        hideSidebar: 'Hide sidebar',
        showSidebar: 'Show sidebar',
        close: 'Close',
      },
      childCards: {
        regenerating: 'Regenerating...',
      },
      cloze: {
        revealedContent: 'Revealed: {content}',
        hiddenContent: 'Hidden content, click to reveal',
        clickToReveal: 'Click to reveal',
      },
      choiceAccuracy: {
        label: 'Accuracy',
        tooltipTitle: 'Choice Accuracy',
        correct: 'Correct',
        rating: 'Rating',
        excellent: 'Excellent',
        good: 'Good',
        pass: 'Pass',
        needsWork: 'Needs Work',
      },
      kanban: {
        groupBy: {
          status: 'Study Status',
          type: 'Question Type',
          priority: 'Priority',
          deck: 'Deck',
          createTime: 'Created',
          tag: 'Tag',
        },
        sort: {
          created: 'Created',
          due: 'Due Date',
          modified: 'Modified',
          priority: 'Priority',
          difficulty: 'Difficulty',
          title: 'Title',
          asc: 'Ascending',
          desc: 'Descending',
        },
        groupTitle: {
          byStatus: 'Group by Study Status',
          byType: 'Group by Question Type',
          byPriority: 'Group by Priority',
          byDeck: 'Group by Deck',
          byCreateTime: 'Group by Created',
          byTag: 'Group by Tag',
        },
        status: {
          new: 'New',
          learning: 'Learning',
          review: 'Review',
          relearning: 'Relearning',
        },
        type: {
          qa: 'Q&A',
          choice: 'Choice',
          cloze: 'Cloze',
        },
        priorityLevel: {
          high: 'High Priority',
          medium: 'Medium Priority',
          low: 'Low Priority',
          none: 'No Priority',
        },
        time: {
          today: 'Today',
          yesterday: 'Yesterday',
          last7days: 'Last 7 Days',
          last30days: 'Last 30 Days',
          earlier: 'Earlier',
        },
        menu: {
          viewOptions: 'View Options',
          groupByLabel: 'Group By',
          sortLabel: 'Sort',
          sortRulesCount: '{n} rules',
          noSort: 'None',
          hideEmptyGroups: 'Hide Empty Groups',
          toggleHideEmpty: 'Toggle hide empty groups',
          fillColumnBg: 'Fill Column Background',
          toggleFillColumnBg: 'Toggle fill column background',
          groups: 'Groups',
          reset: 'Reset',
          showAll: 'Show All',
          hideAll: 'Hide All',
          showAllColumns: 'Show all columns',
          hideAllColumns: 'Hide all columns',
          showColumn: 'Show column',
          hideColumn: 'Hide column',
          addSortRule: 'Add Sort Rule',
          clearAllSorts: 'Clear All Sorts',
          deleteSortRule: 'Delete sort rule',
          selectProperty: 'Select Property',
        },
        cards: {
          cardsUnit: 'cards',
          selectAll: 'Select all in group',
          due: 'due',
          selected: 'selected',
          loadMore: 'Load more ({n} remaining)',
          ariaGroup: '{label} group',
        },
        drag: {
          statusRestriction: 'Study status is managed by FSRS6 algorithm and cannot be changed manually.\nPlease use the study feature to update card status.',
          typeRestriction: 'Card type cannot be changed by dragging',
          timeRestriction: 'Created time cannot be modified',
          noDeckRestriction: 'Cards must belong to a deck and cannot be moved to "No Deck"',
        },
      },
      viewWrapper: {
        loading: 'Loading study cards...',
        loadingDeckName: 'Loading...',
        unknownDeck: 'Unknown Deck',
        advanceNeedsDeck: 'Advance study requires a deck',
        noExamBank: 'No exam bank found for this deck',
        examNotEnabled: 'Question bank feature not enabled',
        examFailed: 'Failed to start exam',
      },
      unifiedActions: {
        selectDeck: 'Select deck...',
        importToDeck: 'Import to memory deck:',
        regeneratingWait: 'Regenerating, please wait...',
        selectTargetDeck: 'Please select a target deck first',
      },
      sidebar: {
        studyStats: 'Study Stats',
        completedToday: 'Completed Today',
        remainingCards: 'Remaining',
        studyProgress: 'Progress',
        cardsUnit: '',
        sourceNote: 'Source Note',
        openSourceNote: 'Click to open source note',
        unknownNote: 'Unknown note',
        cardRelation: 'Card Relations',
        cardRelationSub: '(Manage|Graph)',
        noCard: 'No card selected',
        knowledgeGraph: 'Knowledge Graph',
        viewNoteGraph: 'View Note Graph',
        studySettings: 'Study Settings',
        reviewMode: 'Review Mode',
        sequential: 'Sequential',
        autoPlay: 'Auto Play',
        off: 'Off',
        showRelation: 'Show Relations',
        on: 'On',
      },
      editor: {
        updateFailed: 'Failed to update editor content',
        sessionCreateFailed: 'Failed to create editor session',
        editorCreateFailed: 'Failed to create editor',
        enterEditFailed: 'Failed to enter edit mode',
        cardSaved: 'Card saved',
        saveFailed: 'Save failed: {error}',
        unknownError: 'Unknown error',
        placeholder: 'Edit card content here...',
        cancel: 'Cancel',
        save: 'Save',
      },
      actionTypeTab: {
        aiFormat: 'AI Format',
        aiSplit: 'AI Split',
      },
      formatPreview: {
        title: 'AI Format Preview - {name}',
        originalContent: 'Original Content',
        noContent: '(No content)',
        formattedContent: 'Formatted',
        unknownError: 'Unknown error',
        cancel: 'Cancel',
        apply: 'Apply Changes',
      },
      cardPreview: {
        ariaLabel: 'Card Preview',
        typeQA: 'Q&A Card',
        typeCloze: 'Cloze Card',
        typeBasic: 'Basic Card',
        clozeCounter: '{revealed}/{total} revealed',
        hintShowAnswer: 'Space: Show Answer',
        hintToggleCloze: 'H: Toggle Cloze',
        answerDivider: 'Answer',
        hideClozeAnswers: 'Hide Cloze Answers',
        showClozeAnswers: 'Show Cloze Answers',
        noClozeMarks: 'No cloze marks detected',
        hideAnswers: 'Hide Answers',
        showAnswers: 'Show Answers ({revealed}/{total})',
        hideBack: 'Hide Back',
        showBack: 'Show Back',
        noInteractiveContent: 'No interactive content',
        metaSource: 'Source: {text}',
        metaParseMethod: 'Parse method: {method}',
        metaConfidence: 'Confidence: {value}%',
      },
      sourceInfo: {
        sourceDoc: 'Source Document',
        siblingCards: 'Sibling Cards',
        thisSession: 'This Session',
        unitCards: '',
      },
      learningSteps: {
        minutes: '{n}min',
        completed: 'Done',
        currentStep: 'Current Step',
        stepN: 'Step {n}',
        nextAppear: 'Next Appearance',
        minutesLater: 'in {n}min',
        nextStep: 'Next Step',
        repeated: 'Repeated',
        repeatedTimes: '{n} times',
      },
      difficultyIndicator: {
        easy: 'Easy',
        medium: 'Medium',
        hard: 'Hard',
        veryHard: 'Very Hard',
        level: 'Difficulty Level',
        consecutiveHard: 'Consecutive Hard',
        consecutiveHardTimes: '{n} times',
        suggestion: 'Suggestion',
        improveSuggestion: 'Improve this card',
        trendRising: 'Difficulty rising',
        trendFalling: 'Difficulty falling',
        interventionNotice: 'Consider improving this card',
        consecutiveInfo: 'Rated hard {n} times in a row',
      },
      statsCards: {
        retention: 'Memory Retention',
        retentionTooltip: 'Retention',
        stability: 'Memory Stability',
        stabilityTooltip: 'Stability',
        difficulty: 'Card Difficulty',
        difficultyTooltip: 'Difficulty',
        nextReview: 'Next Review',
        nextReviewTooltip: 'Next Review',
        unitDays: 'd',
        unknown: 'Unknown',
        today: 'Today',
        daysLater: 'd later',
        nDaysLater: 'in {n}d',
        diffEasy: 'Easy',
        diffMedium: 'Medium',
        diffHard: 'Hard',
        diffVeryHard: 'Very Hard',
        stabUnstable: 'Unstable',
        stabSomewhat: 'Moderate',
        stabStable: 'Stable',
      }
    },
    
    cards: {
      title: 'Card Management',
      actions: {
        create: 'Create Card',
        edit: 'Edit',
        delete: 'Delete',
        duplicate: 'Duplicate',
        move: 'Move',
        export: 'Export',
        import: 'Import'
      },
      filters: {
        all: 'All',
        new: 'New',
        learning: 'Learning',
        review: 'Review',
        suspended: 'Suspended',
        buried: 'Buried'
      },
      fields: {
        front: 'Front',
        back: 'Back',
        tags: 'Tags',
        deck: 'Deck',
        created: 'Created',
        modified: 'Modified'
      }
    },
    
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      warning: 'Warning',
      info: 'Info',
      confirm: 'Confirm',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      confirmDelete: 'Confirm Delete',
      confirmReset: 'Confirm Reset',
      edit: 'Edit',
      close: 'Close',
      retry: 'Retry',
      refresh: 'Refresh',
      reset: 'Reset',
      clear: 'Clear',
      search: 'Search',
      filter: 'Filter',
      sort: 'Sort',
      export: 'Export',
      import: 'Import',
      settings: 'Settings',
      help: 'Help',
      about: 'About',
      notSet: 'Not Set',
      unknown: 'Unknown',
      batchOperations: 'Batch Operations',
      premiumFeature: 'Premium Feature',
      time: {
        seconds: '{count} seconds',
        minutes: '{count} minutes',
        hours: '{count} hours',
        days: '{count} days',
        manual: 'Manual'
      },
      timeUnits: {
        seconds: '{n} seconds',
        minutes: '{n} minutes',
        hours: '{n} hours',
        days: '{n} days',
        weeks: '{n} weeks',
        months: '{n} months',
        years: '{n} years'
      },
      count: {
        items: '{count} items',
        selected: '{count} selected'
      },
      validation: {
        required: 'This field is required',
        invalid: 'Invalid input'
      }
    },
    
    //  New: Main Navigation
    navigation: {
      deckStudy: 'Deck Study',
      deckStudyDesc: 'Browse and study your decks',
      cardManagement: 'Card Management',
      cardManagementDesc: 'Manage and edit all your cards',
      incrementalReading: 'Incremental Reading',
      incrementalReadingDesc: 'Manage reading materials and review schedules',
      aiAssistant: 'AI Assistant',
      aiAssistantDesc: 'Use AI to create and optimize cards',
      switchView: 'Switch View',
      createDeck: 'Create Deck',
      moreActions: 'More Actions',
      search: 'Search',
      searchTooltip: 'Search cards and decks',
      notifications: 'Notifications',
      notificationsTooltip: 'View notifications and reminders',
      settings: 'Settings',
      settingsTooltip: 'Open settings panel'
    },
    
    //  Celebration
    celebration: {
      title: 'Congratulations! Today\'s study complete!',
      subtitle: 'You\'ve finished all learning tasks for "{deckName}"',
      stats: {
        title: 'Today\'s Achievements',
        cardsStudied: 'Cards Studied',
        reviewed: 'Cards Reviewed',
        timeSpent: 'Time Spent',
        studyTime: 'Study Time',
        accuracy: 'Accuracy',
        memoryRate: 'Retention Rate'
      },
      footer: {
        hint: 'You can continue with other decks~',
        closeButton: 'Got it',
        startPracticeButton: 'Start Practice'
      },
      timeFormat: {
        lessThan1Min: '< 1min',
        minutes: '{n}min',
        hoursMinutes: '{h}h {m}min'
      }
    },
    
    // NoCardsAvailableModal
    noCardsModal: {
      closeAriaLabel: 'Close prompt',
      empty: {
        title: 'No cards in this deck yet',
        message: 'Start adding cards to build your knowledge base',
      },
      allLearned: {
        title: "Today's study goal achieved",
        message: 'All due cards in deck "{deckName}" have been reviewed',
      },
      noDue: {
        title: 'No cards due',
        messageWithCount: 'There are {count} cards in this deck, but none are due for review yet',
        messageDefault: 'No cards in this deck are due for review yet',
      },
      default: {
        title: 'No cards to study',
        message: 'There are currently no cards to study in this deck',
      },
      stats: {
        title: 'Deck Statistics',
        totalCards: 'Total Cards',
        learned: 'Learned',
        nextDue: 'Next Due',
        todayNew: 'Today New',
        unit: '',
        completed: 'completed',
      },
      buttons: {
        startExam: 'Start Exam',
        advanceStudy: 'Advance Study',
        viewStats: 'View Stats',
      }
    },

    //  Rating Buttons
    rating: {
      again: 'Again',
      hard: 'Hard',
      good: 'Good',
      easy: 'Easy',
      show: 'Show Answer',
      undo: 'Undo',
      seconds: '{n}s',
      minutes: '{n}m',
      hours: '{n}h',
      days: '{n}d',
      months: '{n}mo',
      years: '{n}y'
    },
    
    //  Notifications
    notifications: {
      success: {
        cardSaved: 'Card Saved',
        cardDeleted: 'Card Deleted',
        deckCreated: 'Deck Created',
        settingsUpdated: 'Settings Updated',
        syncCompleted: 'Sync Completed',
        exportSuccess: 'Export Successful',
        importSuccess: 'Import Successful',
        backupCreated: 'Backup Created',
        optimizationComplete: 'Optimization Complete'
      },
      error: {
        saveFailed: 'Save Failed',
        loadFailed: 'Load Failed',
        deleteFailed: 'Delete Failed',
        syncFailed: 'Sync Failed',
        connectionFailed: 'Connection Failed',
        exportFailed: 'Export Failed',
        importFailed: 'Import Failed',
        validationFailed: 'Validation Failed',
        unknownError: 'Unknown Error Occurred',
        startStudy: 'Error starting study, please try again'
      },
      warning: {
        unsavedChanges: 'Unsaved Changes',
        licenseExpiring: 'License Expiring Soon',
        licenseExpired: 'License Expired',
        backupFailed: 'Backup Failed',
        syncConflict: 'Sync Conflict'
      },
      info: {
        loading: 'Loading...',
        syncing: 'Syncing...',
        processing: 'Processing...',
        generating: 'AI Generating...',
        optimizing: 'Optimizing...'
      }
    },
    
    //  Menus and Tooltips
    menus: {
      context: {
        edit: 'Edit',
        delete: 'Delete',
        duplicate: 'Duplicate',
        copy: 'Copy Content',
        moveTo: 'Move To',
        addTags: 'Add Tags',
        removeTags: 'Remove Tags',
        suspend: 'Suspend',
        unsuspend: 'Unsuspend',
        bury: 'Bury',
        unbury: 'Unbury',
        flag: 'Flag',
        unflag: 'Unflag'
      },
      tooltips: {
        clickToEdit: 'Click to edit',
        doubleClickToView: 'Double click to view details',
        dragToSort: 'Drag to sort',
        rightClickForMore: 'Right click for more options'
      }
    },
    
    //  Study Interface
    studyInterface: {
      showAnswer: 'Show Answer',
      confirmAnswer: 'Confirm Answer',
      closeStudy: 'Close Study Interface',
      hint: {
        showHint: 'Hint',
        noHint: 'No hint for this card',
        usesRemaining: '{n} uses left',
        usedUp: 'No hints remaining',
      },
      ratings: {
        again: 'Again',
        hard: 'Hard',
        good: 'Good',
        easy: 'Easy'
      },
      intervals: {
        unknown: 'Unknown',
        lessThan1Min: '< 1min',
        minutes: '{n}min',
        hours: '{n}h',
        days: '{n}d',
        months: '{n}mo',
        years: '{n}y'
      },
      errors: {
        invalidCard: 'Invalid card data',
        invalidCardId: 'Invalid card ID',
        invalidFields: 'Invalid fields structure',
        renderError: 'Render Error',
        noContent: 'No Content',
        processingError: 'Processing Error',
        defaultFieldFailed: 'Default field processing failed',
        degradedFieldFailed: 'Degraded field processing failed'
      },
      labels: {
        error: 'Error',
        statsDetails: 'Stats Details',
        noTemplates: 'No templates found',
        setReminder: 'Set Review Reminder',
        setPriority: 'Set Priority'
      },
      progress: {
        ariaLabel: 'Study Progress',
        newCards: 'New {n}',
        learning: 'Learning {n}',
        review: 'Due {n}',
        mastered: 'Mastered {n}',
        total: 'Total {n} cards'
      },
      actions: {
        return: 'Return',
        regenerate: 'Regenerate',
        collect: 'Collect ({n})',
        undo: 'Undo'
      }
    },
    
    //  Card Management Page
    cardManagement: {
      more: 'More',
      search: 'Search',
      viewModes: {
        title: 'View',
        table: 'Table View',
        grid: 'Grid View',
        kanban: 'Kanban View'
      },
      layout: {
        title: 'Layout',
        fixed: 'Fixed Height',
        waterfall: 'Waterfall'
      },
      gridAttributeSelector: {
        tooltip: 'Card Attribute Display',
        title: 'Top-Left Attribute',
        none: 'None',
        uuid: 'Unique ID',
        source: 'Source Document',
        priority: 'Priority',
        retention: 'Retention Rate',
        modified: 'Modified Time',
        accuracy: 'Accuracy',
        question_type: 'Question Type',
        ir_state: 'Reading Status',
        ir_priority: 'IR Priority'
      },
      density: {
        title: 'Density',
        compact: 'Compact',
        comfortable: 'Comfortable',
        spacious: 'Spacious'
      },
      tools: {
        title: 'Tools',
        scanOrphans: 'Scan Orphan Cards',
        fieldManagement: 'Field Management',
        columnSettings: 'Column Settings'
      },
      filters: {
        showAll: 'Show All',
        appliedFilters: 'Filters Applied',
        clearAll: 'Clear All Filters',
        deck: 'Deck',
        priority: 'Priority',
        time: 'Time'
      },
      empty: {
        hint: 'Please add cards or adjust filters'
      },
      batchToolbar: {
        selected: '{count} cards selected',
        copy: 'Copy',
        changeDeck: 'Change Deck',
        changeTemplate: 'Change Template (Unavailable)',
        addTags: 'Add Tags',
        removeTags: 'Remove Tags',
        exportToMd: 'Export as Notes',
        exportSingleFile: 'Export as Single Note',
        exportBySource: 'Export by Source Document',
        exportSelectFolder: 'Select Save Location',
        exportSuccess: 'Exported {count} cards to {path}',
        exportSuccessMultiple: 'Exported {count} cards to {fileCount} files',
        exportFailed: 'Export failed: {error}',
        exportNoCards: 'No cards to export',
        exportFilterYaml: 'Filter YAML metadata',
        exportKeepYaml: 'Keep YAML metadata'
      },
      batchDelete: {
        confirm: 'Are you sure you want to delete {count} selected cards? This action cannot be undone.'
      },
      management: {
        filtered: '{count} cards filtered',
        filterFromSource: '{count} cards filtered (from: {source})',
        destroyingComponent: 'Destroying component, cleaning up resources',
        loadingCards: 'Loading card data...',
        foundDecks: 'Found {count} decks',
        deckCards: 'Deck "{name}": {count} cards',
        totalLoaded: 'Total {count} cards loaded',
        migrationNeeded: 'Detected {count} cards need error tracking migration',
        migrationComplete: 'Error tracking migration complete',
        loadFailed: 'Failed to load card data: {error}',
        transformingData: 'Transforming card data'
      }
    },
    
    //  Deck Study Page
    deckStudyPage: {
      deckTypes: {
        choice: 'Choice Questions'
      },
      urgency: {
        urgent: 'Urgent',
        completed: 'Completed'
      },
      moreActions: 'More Actions',
      tableHeaders: {
        deckName: 'Deck Name',
        newCards: 'New',
        learning: 'Learning',
        review: 'Review',
        actions: 'Actions'
      },
      import: {
        success: 'Import successful! Deck: {deckName}, Imported: {count} cards',
        error: 'Import failed: {error}',
        failed: 'Import failed'
      },
      dataChange: 'Deck data changed',
      filters: {
        memoryMode: 'Show all memory decks',
        readingMode: 'Progressive reading',
        questionBank: 'Question bank decks'
      },
      study: {
        targetDeckFound: 'Target deck found, starting study',
        noDeckAvailable: 'No cards to study',
        noAdvanceCards: 'No cards available for advance study'
      },
      tree: {
        firstUseExpand: 'First use, expanding root-level decks by default',
        loading: 'Loading deck tree...'
      },
      stats: {
        recordingInstances: 'Recording study instances for each deck',
        calculatingDailyQuota: 'Calculating daily studied quota for each deck',
        loadingStats: 'Loading deck statistics...'
      },
      views: {
        grid: 'Grid Cards',
        gridDesc: 'Colorful card display',
        kanban: 'Kanban View',
        kanbanDesc: 'Organized by stage, visual workflow'
      },
      menu: {
        importAPKG: 'Import APKG File',
        importCSV: 'Import CSV File',
        importClipboard: 'Paste Cards Import',
        exportJSON: 'Export JSON Data',
        importFolder: 'Import Folder',
        management: 'Management',
        restoreTutorialDeck: 'Restore Tutorial Deck'
      },
      notices: {
        tutorialRestored: 'Tutorial deck restored',
        tutorialRestoreFailed: 'Failed to restore tutorial deck',
        noBlocks: 'No content blocks in this deck',
        noDueBlocks: '"{name}" has no due content blocks',
        startReadingFailed: 'Failed to start reading',
        qbServiceNotInit: 'Question bank service not initialized',
        noQuestions: 'No questions in this bank',
        startExamFailed: 'Failed to start exam',
        deckNotFound: 'Deck not found',
        deckUpdated: 'Deck updated',
        editFailed: 'Edit failed',
        exportFailed: 'Export failed'
      },
      edit: {
        title: 'Edit Deck',
        name: 'Name',
        tag: 'Deck Tag (Single)',
        tagDesc: 'Tags are used for categorization, only one tag allowed',
        tagPlaceholder: 'Enter tag and press Enter to add',
        description: 'Description',
        descPlaceholder: 'Optional'
      },
      fallback: {
        deck: 'Deck',
        incrementalReading: 'Incremental Reading',
        unknownBank: 'Unknown Bank'
      },
      studyActions: {
        startError: 'Error starting study, please try again.',
        loading: 'Loading deck data...',
        studyButton: 'Study',
        completedButton: 'Done',
        advanceStudy: 'Advance Study',
        noAdvanceCards: 'No cards available for advance study',
        advanceStudyStarted: 'Started advance study ({count} not-yet-due cards)',
        advanceStudyFailed: 'Failed to start advance study',
        collapse: 'Collapse',
        expand: 'Expand'
      },
      exam: {
        missingDeckInfo: 'Cannot start exam: missing deck info',
        qbNotEnabled: 'Question bank feature not enabled',
        noPairedBank: 'No paired question bank found for this deck',
        startFailed: 'Failed to start exam'
      },
      time: {
        tomorrow: 'Tomorrow',
        hoursLater: 'in {hours} hours',
        minutesLater: 'in {minutes} minutes'
      },
      editModal: {
        deckName: 'Deck Name',
        deckNameDesc: 'Enter the display name for the deck',
        deckNamePlaceholder: 'Enter deck name',
        tags: 'Tags',
        addTag: '+ Add',
        noTags: 'No tags',
        tagNamePlaceholder: 'Enter tag name',
        confirm: 'OK',
        deckNameRequired: 'Deck name cannot be empty',
        updateFailed: 'Update failed'
      },
      deleteModal: {
        title: 'Confirm Delete',
        confirmMessage: 'Are you sure you want to delete deck "{name}"?',
        cardWarning: 'This deck references {count} cards. Deleting will also remove all referenced cards (even if referenced by other decks).',
        irreversible: 'This action cannot be undone!',
        confirmButton: 'Confirm Delete',
        progressTitle: 'Deleting Deck Cards',
        progressDesc: 'Deleting {count} cards from deck "{name}"...',
        cleaningRefs: 'Cleaning up references from other decks...',
        refsCleaned: 'References cleaned',
        deletingCards: 'Deleting card data...',
        cardsDeleted: 'Card data deleted',
        cleaningCache: 'Cleaning cache...',
        cacheCleaned: 'Cleanup complete',
        deletedCount: 'Deleted {count} cards',
        success: 'Successfully deleted deck "{name}"',
        successWithCards: 'Successfully deleted deck "{name}" and its {count} cards',
        failed: 'Delete failed'
      },
      dissolve: {
        title: 'Dissolve Deck',
        confirmMessage: 'Are you sure you want to dissolve deck "{name}"?',
        cardCount: 'This deck references {count} cards.',
        warning: 'After dissolving, the deck will be deleted but card data will be preserved.',
        confirmButton: 'Confirm Dissolve',
        inProgress: 'Dissolving deck...',
        success: 'Deck "{name}" dissolved',
        orphanedCards: ', {count} cards became orphaned',
        failed: 'Dissolve failed',
        serviceNotInit: 'Reference deck service not initialized'
      },
      analyticsAction: {
        openFailed: 'Failed to open deck analytics'
      },
      contextMenu: {
        advanceStudy: 'Advance Study',
        deckAnalytics: 'Deck Analytics',
        editDeck: 'Edit Deck',
        delete: 'Delete',
        dissolveDeck: 'Dissolve Deck'
      },
      subdeck: {
        indicator: 'Contains {total} subdeck cards (New: {newCards}, Learning: {learning}, Review: {review})'
      }
    },
    
    //  Filter Components
    filters: {
      loading: 'Loading filter data...',
      sections: {
        decks: 'Deck Filter',
        types: 'Type Filter',
        priority: 'Priority',
        tags: 'Tag Filter',
        time: 'Time Filter'
      },
      allDecks: 'All Decks',
      noTags: 'No tags',
      clearAll: 'Clear All Filters',
      myFilters: 'My Filters',
      manage: 'Manage',
      cardTypes: {
        qa: 'Q&A',
        choice: 'Multiple Choice',
        fill: 'Fill in Blank',
        cloze: 'Cloze'
      },
      priorities: {
        all: 'All',
        high: 'High Priority',
        medium: 'Medium Priority',
        low: 'Low Priority',
        none: 'No Priority'
      },
      timeFilters: {
        all: 'All',
        today: 'Today',
        dueToday: 'Due Today',
        addedToday: 'Added Today',
        editedToday: 'Edited Today',
        reviewedToday: 'Reviewed Today',
        firstReview: 'First Review',
        retryToday: 'Retry Today',
        neverReviewed: 'Never Reviewed'
      },
      status: {
        new: 'New',
        learning: 'Learning',
        review: 'Review',
        mastered: 'Mastered'
      },
      advancedBuilder: {
        title: 'Advanced Filter Builder',
        addGroup: 'Add Group',
        addCondition: 'Add Condition',
        removeGroup: 'Remove Group',
        results: 'Results',
        calculating: 'Calculating',
        cards: 'cards',
        apply: 'Apply',
        save: 'Save',
        cancel: 'Cancel',
        enableCondition: 'Click to enable this condition',
        disableCondition: 'Click to disable this condition'
      }
    },
    
    //  UI Component Common Translations
    ui: {
      cancel: 'Cancel',
      confirm: 'Confirm',
      delete: 'Delete',
      save: 'Save',
      edit: 'Edit',
      close: 'Close',
      closeNotification: 'Close notification',
      newCard: 'New Card',
      progressBar: 'Progress bar',
      hideMonitor: 'Hide monitor',
      technicalDetails: 'Technical details',
      metrics: {
        memoryUsage: 'Memory Usage',
        cacheHitRate: 'Cache Hit Rate',
        throughput: 'Throughput',
        networkLatency: 'Network Latency',
        errorRate: 'Error Rate'
      },
      pagination: {
        previous: 'Previous',
        next: 'Next',
        page: 'Page {n}',
        total: '{n} cards total'
      },
      tables: {
        loading: 'Loading...',
        empty: 'No data',
        selectAll: 'Select All'
      }
    },
    
    //  Table Components
    tables: {
      card: {
        loading: 'Loading cards...',
        empty: 'No cards'
      }
    },
    
    //  FSRS Algorithm Settings
    fsrs: {
      title: 'FSRS6 Algorithm Settings',
      description: 'Configure spaced repetition algorithm parameters',
      savedMessage: 'FSRS6 settings saved',
      saveFailed: 'Failed to save settings',
      basicParams: {
        title: 'Basic Parameters',
        retention: {
          label: 'Target Retention',
          description: 'Desired long-term memory retention rate (0.5-0.99)'
        },
        maxInterval: {
          label: 'Maximum Interval',
          description: 'Maximum review interval in days'
        },
        enableFuzz: {
          label: 'Enable Randomization',
          description: 'Add random fluctuation to calculated intervals'
        }
      },
      advancedSettings: {
        title: 'Advanced Settings',
        weights: {
          title: 'Weight Parameters',
          description: '21 weight parameters of FSRS6 algorithm, affecting memory prediction accuracy',
          allowEdit: 'Allow Editing',
          locked: 'Weight parameters are locked, enable "Allow Editing" to modify',
          warning: 'Modifying weight parameters may affect learning effectiveness, please proceed with caution',
          reset: 'Reset Default'
        }
      },
      optimization: {
        title: 'Smart Optimization',
        description: 'Automatically optimize FSRS6 parameters based on your learning data',
        overview: {
          title: 'Optimization Overview',
          description: 'Click FSRS6 Standard Model to optimize algorithm',
          algorithmVersion: 'Algorithm Version',
          systemVersion: 'System Version',
          reviewRecords: 'Review Records',
          optimizationResult: 'Optimization Result',
          consecutiveParams: 'Consecutive Params',
          dataPoints: 'Data Points',
          refresh: 'Refresh'
        },
        dataPoints: 'Data Points',
        accuracy: 'Prediction Accuracy',
        status: 'Optimization Status',
        statusReady: 'Ready',
        statusOptimizing: 'Optimizing...',
        startButton: 'Start Optimization',
        optimizingButton: 'Optimizing...',
        complete: 'Parameter optimization complete',
        failed: 'Parameter optimization failed'
      },
      performance: {
        title: 'Performance Monitoring',
        description: 'Real-time monitoring of FSRS6 algorithm status and performance metrics',
        refresh: 'Refresh',
        algorithmVersion: 'Algorithm Version',
        executionTime: 'Execution Time',
        cacheHitRate: 'Cache Hit Rate',
        activeInstances: 'Active Instances',
        noData: 'Click refresh button to get performance metrics'
      },
      parameters: {
        title: 'Algorithm Parameters',
        targetRetention: {
          label: 'Target Retention',
          description: 'Desired long-term memory retention rate (0.5-0.99)',
          placeholder: 'e.g., 0.9 for 90% retention'
        },
        maxInterval: {
          label: 'Maximum Interval',
          description: 'Maximum days between reviews',
          unit: 'days'
        }
      },
      actions: {
        reset: 'Reset to Default',
        import: 'Import Parameters',
        export: 'Export Parameters',
        save: 'Save Parameters',
        cancel: 'Cancel'
      }
    },
    
    epub: {
      export: {
        readingNotes: 'Reading Notes',
        bookInfo: 'Book Info',
        author: 'Author',
        publisher: 'Publisher',
        readingProgress: 'Reading Progress',
        bookmarks: 'Bookmarks',
        highlights: 'Highlights',
        notes: 'Notes',
        colorYellow: 'Yellow Highlight',
        colorGreen: 'Green Highlight',
        colorBlue: 'Blue Highlight',
        colorPink: 'Pink Highlight',
        colorPurple: 'Purple Highlight'
      }
    },
    
    //  Card Parsing Settings
    parsing: {
      title: 'Card Parsing Settings',
      description: 'Configure batch card parsing rules for Markdown files',
      batchParsing: {
        title: 'Batch Parsing',
        enable: {
          label: 'Enable Batch Parsing',
          description: 'Scan and batch create cards from file markers'
        },
        markers: {
          title: 'Parse Markers',
          startMarker: {
            label: 'Start Marker',
            description: 'Start marker for batch parsing',
            default: '---start---'
          },
          endMarker: {
            label: 'End Marker',
            description: 'End marker for batch parsing',
            default: '---end---'
          }
        }
      },
      cloze: {
        title: 'Cloze Grammar',
        defaultSyntax: {
          label: 'Default Syntax',
          markdown: 'Markdown Highlight (==text==)',
          anki: 'Anki Format ({{c1::text}})'
        },
        autoDetect: {
          label: 'Auto Detect',
          description: 'Automatically detect and support both syntaxes'
        }
      }
    },
    
    //  AI Card Creation
    aiConfig: {
      title: 'AI Card Creation',
      description: 'Configure AI-assisted card creation features',
      providers: {
        title: 'AI Providers',
        openai: 'OpenAI',
        gemini: 'Google Gemini',
        anthropic: 'Anthropic Claude',
        deepseek: 'DeepSeek',
        zhipu: 'Zhipu AI',
        siliconflow: 'SiliconFlow',
        select: 'Select Provider'
      },
      apiKeys: {
        title: 'API Key Configuration',
        apiKeyLabel: 'API Key',
        apiKeyDescription: 'Enter your {provider} API key',
        modelLabel: 'Model',
        modelDescription: 'Select the AI model to use',
        testConnection: 'Test Connection',
        testing: 'Testing...',
        testSuccess: 'Connection successful!',
        testFailed: 'API key not configured',
        show: 'Show',
        hide: 'Hide',
        verified: 'Verified',
        defaultBadge: 'Default',
        formattingBadge: 'Formatting',
        splittingBadge: 'Splitting',
        menuLabel: 'Provider configuration menu',
        configOptions: 'Configuration Options',
        menu: {
          customApiUrl: 'Custom API URL',
          editApiUrl: 'Edit API URL',
          resetApiUrl: 'Reset to Default URL',
          addCustomModel: 'Add Custom AI Model'
        },
        customModel: {
          title: 'Add Custom AI Model',
          nameLabel: 'Model Name',
          namePlaceholder: 'E.g.: gpt-4o-2024-05-13',
          nameHint: 'Enter the full model name as shown in the API documentation',
          emptyError: 'Model name cannot be empty',
          invalidCharsError: 'Model name contains invalid characters, only letters, numbers, hyphens, dots and slashes are allowed',
          tooLongError: 'Model name is too long, max 100 characters',
          validMessage: 'Model name format is correct',
          save: 'Save',
          cancel: 'Cancel'
        }
      },
      models: {
        title: 'Model Selection',
        select: 'Select Model',
        recommended: 'Recommended'
      },
      promptTemplates: {
        title: 'Prompt Template Management',
        official: {
          title: 'Official Templates',
          count: '{n} templates',
          badge: 'Official',
          viewDetail: 'View Details'
        },
        custom: {
          title: 'Custom Templates',
          count: '{n} templates',
          create: 'New Template',
          edit: 'Edit',
          delete: 'Delete',
          deleteConfirm: 'Are you sure you want to delete this template?'
        },
        modal: {
          createTitle: 'New Template',
          editTitle: 'Edit Template',
          name: 'Template Name',
          namePlaceholder: 'E.g.: Standard Q&A Generation',
          content: 'Prompt Content',
          contentHelper: 'Use {variable} to define replaceable variables, e.g.: {count}, {difficulty}',
          contentPlaceholder: 'Generate {count} Q&A cards based on the following content...',
          detectedVariables: 'Detected Variables',
          variables: 'Variables:',
          cancel: 'Cancel',
          save: 'Save'
        }
      },
      globalParams: {
        temperature: {
          label: 'Temperature',
          description: 'Control AI response randomness. Lower = more deterministic, Higher = more creative. Recommended: 0.5-1.0'
        },
        maxTokens: {
          label: 'Max Tokens',
          description: 'Maximum tokens per request. Recommended: 1000-4000'
        },
        requestTimeout: {
          label: 'Request Timeout',
          description: 'API request timeout in seconds. Recommended: 30-60s'
        },
        concurrentLimit: {
          label: 'Concurrent Request Limit',
          description: 'Maximum concurrent requests. Recommended: 1-5'
        }
      },
      imageGeneration: {
        defaultSyntax: {
          label: 'Default Image Syntax',
          description: 'Choose default syntax format for inserting images',
          wiki: 'Wiki Link (![[image.png]])',
          markdown: 'Markdown (![](image.png))'
        },
        attachmentDir: {
          label: 'Attachment Directory',
          description: 'AI-generated images will be saved to this directory',
          placeholder: 'attachments/ai-generated'
        },
        autoCreateSubfolders: {
          label: 'Auto Create Subfolders',
          description: 'Automatically create date-based subfolders to organize images'
        },
        includeTimestamp: {
          label: 'Include Timestamp in Filename',
          description: 'Include generation timestamp in image filenames'
        },
        includeCaption: {
          label: 'Auto Add Image Caption',
          description: 'Automatically add AI-generated caption below images'
        }
      },
      notices: {
        apiUrlUpdated: '{provider} API URL updated',
        apiUrlReset: '{provider} reset to default URL',
        modelValidationFailed: 'Model name validation failed'
      },
      cardSplitting: {
        title: 'AI Card Splitting Configuration',
        enabled: {
          label: 'Enable AI Splitting',
          description: 'Show AI split button in study interface to split complex cards into multiple sub-cards'
        },
        defaultTargetCount: {
          label: 'Default Generation Count',
          description: 'Default number of sub-cards to generate (0 = let AI decide, usually 2-5 cards)'
        },
        minContentLength: {
          label: 'Minimum Content Length',
          description: 'Only cards with content length above this value can be split (characters)'
        },
        maxContentLength: {
          label: 'Maximum Content Length',
          description: 'Content exceeding this length will be truncated before splitting (characters)'
        },
        autoInheritTags: {
          label: 'Auto Inherit Tags',
          description: 'Sub-cards automatically inherit all tags from parent card'
        },
        autoInheritSource: {
          label: 'Auto Inherit Source Info',
          description: 'Sub-cards automatically inherit Obsidian source document and block links from parent'
        },
        requireConfirmation: {
          label: 'Require Confirmation Before Adding',
          description: 'User confirmation required before adding sub-cards to deck (recommended)'
        },
        defaultInstruction: {
          label: 'Default Split Instruction (Optional)',
          description: 'Custom instructions for AI splitting, e.g., "Focus on definitions and examples" (leave empty for default)',
          placeholder: 'Enter custom split instructions...',
          allowEdit: 'Allow Editing Prompt',
          locked: 'Default prompt is locked, toggle switch to unlock editing',
          usingDefault: 'Currently using system default prompt (leave empty to use default)',
          warning: 'Custom prompts may affect AI splitting quality, depends on prompt quality and AI model',
          viewDefault: 'View System Default Prompt',
          defaultPromptContent: `You are a professional learning card splitting assistant, following the "Minimum Information Principle".

Your task is to split a parent card containing multiple knowledge points into multiple independent sub-cards. Each sub-card should contain only one clear knowledge point.

Splitting Principles:
1. Each sub-card contains only one core concept or knowledge point
2. Maintain independence and completeness of sub-cards
3. Sub-cards should be independently reviewable and understandable
4. Retain necessary context but avoid duplicate information
5. Maintain the original format style and expression

Output Format (JSON):
{
  "cards": [
    {
      "front": "Question or prompt",
      "back": "Answer or explanation",
      "tags": ["optional tags"],
      "explanation": "optional additional explanation"
    }
  ]
}`
        }
      }
    },
    
    //  Data Management
    dataManagement: {
      title: 'Data Management',
      description: 'Manage plugin data import, export, and backup',
      panelTitle: 'Data Management Panel',
      confirmDialog: {
        confirm: 'Confirm',
        cancel: 'Cancel',
        confirmPhrase: 'confirm',
        securityLevels: {
          safe: 'Safe Operation',
          caution: 'Caution Required',
          danger: 'Dangerous Operation'
        },
        operationDetails: 'Operation Details:',
        warnings: 'Warnings:',
        typeToConfirm: 'Type "{phrase}" to confirm:',
        inputMismatch: 'Input does not match',
        processing: 'Processing...',
        processingOverlay: 'Processing operation...'
      },
      progress: {
        calculating: 'Calculating...',
        cancelOperation: 'Cancel operation',
        progressLabel: 'Progress:',
        elapsedTime: 'Elapsed:',
        remainingTime: 'Remaining:'
      },
      backupHistory: {
        title: 'Backup History',
        noBackups: 'No backup records',
        showingRecent: 'Showing {max} most recent ({total} total)',
        totalBackups: '{count} backups total',
        loadingBackups: 'Loading backup history...',
        backupTypes: {
          auto: 'Auto Backup',
          manual: 'Manual Backup',
          preOperation: 'Pre-operation Backup',
          scheduled: 'Scheduled Backup',
          default: 'Backup'
        },
        corruptWarning: 'Backup file may be corrupted',
        preview: 'Preview',
        previewTitle: 'Preview backup contents',
        restore: 'Restore',
        restoreTitle: 'Restore data from this backup',
        delete: 'Delete',
        deleteTitle: 'Delete this backup',
        retentionHint: 'System automatically retains the {max} most recent backups, older ones will be cleaned up',
        processingBackup: 'Processing backup operation...'
      },
      folderTree: {
        title: 'Folder Structure',
        stats: '{folders} folders, {files} files',
        scannedAt: 'Scanned at: {time}',
        noData: 'No folder structure data',
        collapse: 'Collapse',
        expand: 'Expand',
        openFolder: 'Open folder'
      },
      batchScan: {
        detected: 'Detected:',
        newCards: 'New:',
        updated: 'Updated:',
        errors: 'Errors:',
        successRate: 'Success Rate:',
        regexPresetSaved: 'Regex preset saved',
        deletedMapping: 'Mapping deleted',
        selectFileFirst: 'Please select a {type} first',
        selectDeckFirst: 'Please select a target deck first',
        confirmScanTitle: 'Confirm Scan',
        confirmScanMessage: 'Confirm parsing cards from {type} "{path}" to deck "{deck}"?\n\nThis will perform actual card parsing and saving.',
        cancelled: 'Operation cancelled',
        startParsing: 'Start parsing {type}: {path}',
        batchServiceNotInit: 'Batch parsing service not initialized',
        savingCards: 'Saving {count} cards...',
        saveSuccess: 'Successfully saved {count} cards to deck "{deck}"!',
        saveFailed: 'Failed to save cards: {error}',
        noCardsFound: 'Scan complete, no matching cards found.\nPlease check if files contain valid <-> card separators.',
        scanFailed: 'Scan failed: {error}',
        startScan: 'Start Scan',
        deleteMapping: 'Delete Mapping',
        noDecksAvailable: 'No decks available, please create one in the Deck Study view first',
        tableHeaders: {
          type: 'Type',
          path: 'Path',
          fileMode: 'File Mode',
          regexConfig: 'Regex Config',
          targetDeck: 'Target Deck',
          subfolders: 'Subfolders',
          cardCount: 'Card Count',
          enabled: 'Enabled',
          actions: 'Actions'
        },
        typeFile: 'File',
        typeFolder: 'Folder',
        fileTooltip: 'File (click to switch to folder)',
        folderTooltip: 'Folder (click to switch to file)',
        selectFilePath: 'Select or enter file path...',
        selectFolderPath: 'Select or enter folder path...',
        singleFileCard: 'Single File Single Card',
        multiFileCards: 'Single File Multi Cards',
        noPresets: 'No presets (create one first)',
        selectPreset: 'Select preset...',
        selectDeck: 'Select deck...',
        include: 'Include',
        exclude: 'Exclude',
        cardUnit: '',
        notCounted: 'N/A',
        actionsMenu: 'Actions menu',
        moreActions: 'More actions',
        regexPreset: {
          title: 'Regex Preset Manager',
          newPreset: '+ New Preset',
          officialPresets: 'Official Presets (Quick Import)',
          customPresets: 'Custom Presets',
          modeSeparator: 'Separator',
          modePattern: 'Full Regex',
          syncTagBased: 'Tag-based',
          syncFullSync: 'Full Sync',
          edit: 'Edit',
          delete: 'Delete',
          createTitle: 'Create Regex Preset',
          editTitle: 'Edit Regex Preset',
          close: 'Close',
          presetName: 'Preset Name',
          presetNamePlaceholder: 'e.g. Default Weave Format',
          parsingMode: 'Parsing Mode',
          separatorMode: 'Separator Mode (Simple)',
          patternMode: 'Full Regex Mode (Flexible)',
          cardPattern: 'Card Match Regex',
          cardPatternPlaceholder: 'e.g. Q:\\s*(.+?)\\s*A:\\s*(.+?)',
          cardPatternHelp: 'Match all cards in the full text, extract question and answer via capture groups (parentheses)',
          regexFlags: 'Regex Flags',
          regexFlagsPlaceholder: 'e.g. gs',
          regexFlagsHelp: 'g=global, s=dotAll, i=case-insensitive, m=multiline',
          syncMethod: 'Sync Method',
          tagBasedMode: 'Tag-based Mode',
          fullSyncMode: 'Full Sync Mode',
          cancel: 'Cancel',
          save: 'Save',
          nameEmpty: 'Preset name cannot be empty',
          nameDuplicate: 'Preset name already exists',
          separatorEmpty: 'Card separator cannot be empty',
          separatorInvalid: 'Invalid separator regex: {error}',
          patternEmpty: 'Card match regex cannot be empty',
          patternInvalid: 'Invalid card match regex: {error}',
          created: 'Preset created',
          saved: 'Preset saved',
          confirmDelete: 'Are you sure you want to delete preset "{name}"?',
          confirmDeleteTitle: 'Confirm Delete',
          deleted: 'Preset deleted',
          alreadyExists: 'Preset "{name}" already exists',
          imported: 'Imported preset "{name}"',
          newPresetName: 'New Preset',
          mode: 'Mode:',
          sync: 'Sync:'
        },
        separator: {
          cardSeparatorMethod: 'Card Separator Method',
          useCustomSeparator: 'Use Custom Separator',
          useEmptyLine: 'Use Empty Line Separator',
          emptyLineCount: 'Empty Line Count',
          emptyLineCountPlaceholder: 'e.g. 2',
          emptyLineCountHelp: 'Number of consecutive empty lines (default: 2)',
          cardRangeSeparator: 'Card Range Separator',
          cardRangeSeparatorPlaceholder: 'e.g. %%<->%%',
          cardRangeSeparatorHelp: 'Used to separate card ranges'
        },
        cardId: {
          title: 'Card Identification System',
          desc: 'Assign unique identifiers to cards to prevent duplicate imports and support update tracking. Applies to batch parsing and single card creation.',
          helpTitle: 'How It Works',
          helpFirstParse: 'First parse:',
          helpFirstParseDesc: 'Generate UUID for each card and insert into source file',
          helpSubsequentParse: 'Subsequent parses:',
          helpSubsequentParseDesc: 'Detect UUIDs, identify already-imported cards',
          helpDuplicateHandle: 'Duplicate handling:',
          helpDuplicateHandleDesc: 'Based on strategy, skip, update, or create new cards',
          helpWarning: 'Note:',
          helpWarningDesc: 'Enabling this will automatically modify source files to insert UUID markers. While these markers are designed to be minimally intrusive, we recommend backing up important notes before first use.',
          showHelp: 'Show Help',
          hideHelp: 'Hide Help',
          enableSystem: 'Enable Card Identification System',
          enableDesc: 'Insert unique identifiers in source files to prevent duplicate imports',
          uuidPrefix: 'UUID Prefix',
          uuidPrefixHint: 'Used to identify Weave-generated UUIDs, recommend using an easily recognizable prefix',
          uuidFormat: 'UUID Format',
          formatComment: 'HTML Comment',
          formatFrontmatter: 'Frontmatter',
          formatInlineCode: 'Inline Code',
          formatCommentNote: 'Recommended: Does not affect note rendering, invisible to readers',
          formatFrontmatterNote: 'Suitable for notes already using Frontmatter',
          formatInlineCodeNote: 'Displayed as inline code, visible when reading',
          insertPosition: 'UUID Insert Position',
          posBeforeCard: 'Before Card',
          posAfterCard: 'After Card',
          posInMetadata: 'In Metadata',
          duplicateStrategy: 'Duplicate UUID Strategy',
          strategySkip: 'Skip Duplicates',
          strategySkipDesc: 'When a duplicate UUID is detected, skip importing that card',
          strategySkipUse: 'Use case: Prevent accidental duplicate imports',
          strategyUpdate: 'Update Existing',
          strategyUpdateDesc: 'When a duplicate UUID is detected, update the existing card content',
          strategyUpdateUse: 'Use case: Sync note changes',
          strategyCreateNew: 'Create New Card',
          strategyCreateNewDesc: 'When a duplicate UUID is detected, generate a new UUID and create a new card',
          strategyCreateNewUse: 'Use case: Allow creating multiple cards from the same content',
          advancedOptions: 'Advanced Options',
          autoFixMissing: 'Auto-fix Missing UUIDs',
          autoFixMissingDesc: 'When parsing detects a card without UUID, automatically generate and insert one',
          configPreview: 'Current Config Preview',
          previewFormat: 'UUID Format:',
          previewPosition: 'Insert Position:',
          previewStrategy: 'Duplicate Strategy:',
          disabledTitle: 'UUID Identification Not Enabled',
          disabledDesc: 'Currently each parse creates new cards, which may result in duplicate content.\nEnabling UUID identification allows you to:',
          disabledBenefit1: 'Prevent the same note from being imported multiple times',
          disabledBenefit2: 'Support updating already-imported cards',
          disabledBenefit3: 'Maintain card-to-note correspondence',
          enableNow: 'Enable Now'
        },
        scanResults: {
          title: 'Batch Scan Results',
          close: 'Close',
          totalCards: 'Total Cards',
          newLabel: 'New',
          updatedLabel: 'Updated',
          skippedLabel: 'Skipped (unchanged)',
          conflictLabel: 'Conflicts',
          errorsLabel: 'Errors',
          parseFailed: 'Parse Failed',
          duplicateUUID: 'Duplicate UUID',
          filesProcessed: 'Files processed:',
          filesWithCards: 'With cards:',
          filesSkipped: 'Files skipped:',
          newDecksCreated: 'New decks:',
          scanDuration: 'Scan time:',
          avgSpeed: 'Avg speed:',
          cardsPerSec: 'cards/sec',
          fileUnit: '',
          seconds: 's',
          viewErrors: 'View Error Details',
          viewConflicts: 'View Conflict Details',
          conflictHint: 'The following cards were modified in both the source file and Weave, requiring manual conflict resolution:',
          cardIndex: 'Card #{index}',
          useSourceVersion: 'Use Source Version',
          keepWeaveVersion: 'Keep Weave Version',
          viewDuplicates: 'View Duplicate UUID Details',
          duplicateHint: 'The following UUIDs already exist in the database and may cause card conflicts or data overwrite:',
          viewNewDecks: 'View New Deck Details',
          newDecksHint: 'The following decks were automatically created during batch scanning:'
        }
      },
      batchScope: {
        autoTriggerTitle: 'Batch Parsing Auto Trigger',
        usageTips: 'Usage Tips',
        tipAutoTrigger: 'Auto Trigger',
        tipAutoTriggerDesc: 'Automatically parse when editing files (current file only)',
        tipManualTrigger: 'Manual Trigger',
        tipManualTriggerDesc: 'Use hotkeys to execute batch parsing commands',
        tipShortcut: 'Shortcut Settings',
        tipShortcutDesc: 'Search "batch parsing" in Obsidian Settings > Hotkeys',
        tipPerformance: 'Performance Tips',
        tipPerformanceDesc: 'Debounce delay recommended at 2000ms, batch limit at 50 files',
        enableAutoTrigger: 'Enable Auto Trigger',
        enableAutoTriggerDesc: 'Automatically detect and parse batch ranges when editing files (active file only)',
        debounceDelay: 'Debounce Delay (ms)',
        debounceHint: 'Wait time after editing stops before triggering parse (recommended 1000-3000ms)',
        activeFileOnly: 'Active File Only',
        activeFileOnlyDesc: 'Auto trigger only applies to the currently active file',
        batchConfigTitle: 'Batch Parsing Config',
        defaultDeck: 'Default Deck',
        defaultDeckHint: 'Cards created by batch parsing will be added to this deck by default. If not specified, the first available deck will be used.',
        useFirstDeck: '(Use first available deck)',
        defaultPriority: 'Default Priority',
        defaultPriorityHint: 'Default priority for cards created by batch parsing (0-10, 0 is lowest)',
        folderScopeTitle: 'Folder Scan Scope',
        includeFolders: 'Include Folders',
        includeFoldersHint: 'Specify folders to scan. Leave empty to scan the entire vault (except excluded folders).',
        excludeFolders: 'Exclude Folders',
        excludeFoldersHint: 'Specify folders to exclude (will not be scanned)',
        rootDir: '(Root)',
        removeFolder: 'Remove folder',
        selectFolder: 'Select Folder',
        addFolder: '+ Add Folder',
        maxFilesPerBatch: 'Max Files Per Batch',
        maxFilesHint: 'Maximum files to process when manually triggering batch parsing (prevents performance issues)',
        scopePreview: 'Scan Scope Preview',
        previewInclude: 'Include folders:',
        previewExclude: 'Exclude folders:',
        previewAutoTrigger: 'Auto trigger:',
        allFolders: 'All',
        enabled: 'Enabled',
        disabled: 'Disabled'
      },
      templateMgmt: {
        copyLabel: '(Copy)',
        deleteLinkedWarning: 'Warning: This template is linked to {count} cards.\n\nDeleting this template will also delete those cards, and this cannot be undone!\n\nAre you sure you want to continue?',
        confirmDelete: 'Confirm Delete',
        deleteBtn: 'Delete',
        deleteCardsFailed: 'Failed to delete linked cards, operation cancelled',
        confirmDeleteSimple: 'Are you sure you want to delete this template?',
        deletedWithCards: 'Deleted template and its {count} linked cards',
        deletedTemplate: 'Template deleted'
      },
      templateEditor: {
        viewDetails: 'View Template Details',
        templateName: 'Template Name',
        templateNamePlaceholder: 'e.g. Basic Q&A Card',
        templateDesc: 'Template Description',
        templateDescPlaceholder: 'Template purpose description',
        cardType: 'Card Type',
        cardTypeQA: 'Q&A',
        cardTypeChoice: 'Multiple Choice',
        cardTypeCloze: 'Cloze Deletion',
        cardTypeOther: 'Other',
        cardTypeHelp: 'This template is used for AI generation and single card editing',
        parsingMode: 'Parsing Mode',
        singleFieldParsing: 'Single Field Parsing',
        singleFieldDesc: 'This template uses single field parsing mode, suitable for AI generation and single card editing.',
        singleFieldNote: 'Batch parsing has been moved to the "Separator Config" tab.',
        fieldConfig: 'Field Config',
        regexTag: 'Regex',
        requiredTag: 'Required',
        close: 'Close'
      },
      systemPrompt: {
        useBuiltin: 'Use Built-in System Prompt',
        useBuiltinDesc: 'The built-in system prompt contains complete format specifications and generation requirements, ensuring standardized learning card generation.',
        builtinTitle: 'Built-in System Prompt',
        readonlyBadge: 'Read-only',
        collapse: 'Collapse',
        viewContent: 'View Content',
        previewNote: 'This is a sample preview (based on default config). Actual prompts will dynamically adjust based on generation settings.',
        builtinPurpose: 'Purpose of the built-in system prompt:',
        builtinBenefit1: 'Define standard card JSON format (Q&A, cloze, multiple choice)',
        builtinBenefit2: 'Specify required fields and optional enhancement fields (Hint, Explanation, etc.)',
        builtinBenefit3: 'Define the {checkmark} marking syntax for multiple choice',
        builtinBenefit4: 'Guide generation of high-quality learning cards',
        customTitle: 'Custom System Prompt',
        customBadge: 'Custom',
        useAsTemplate: 'Use Built-in as Template',
        useAsTemplateTitle: 'Use built-in prompt as starting point',
        restoreDefault: 'Restore Default',
        editPrompt: 'Edit System Prompt',
        lastModified: 'Last modified: ',
        confirmRestore: 'Are you sure you want to restore the default system prompt? This will clear your custom content.',
        confirmRestoreTitle: 'Confirm Restore Default',
        confirmOverwrite: 'This will overwrite your current custom content. Continue?',
        confirmOverwriteTitle: 'Confirm Overwrite',
        warningTitle: 'Important Notes:',
        warning1: 'Custom system prompts may result in card formats incompatible with Weave',
        warning2: 'Ensure you include necessary JSON format specifications and field definitions',
        warning3: 'Multiple choice must specify using {checkmark} to mark correct answers',
        warning4: 'Cloze deletion must specify using ==text== syntax',
        warning5: 'Recommend using "Built-in as Template" first, then modifying from there',
        availableVars: 'Available Variables',
        varCardCount: 'Card count',
        varDifficulty: 'Difficulty level',
        varQaPercent: 'Q&A percentage',
        varClozePercent: 'Cloze percentage',
        varChoicePercent: 'Choice percentage',
        varAutoReplace: 'These variables will be automatically replaced with corresponding values during use',
        editorPlaceholder: 'Enter custom system prompt here...'
      },
      officialStandard: 'Official Standard',
      panelDescription: 'Integrated interface for all data management functions',
      initFailed: 'Service initialization failed',
      refreshFailed: 'Refresh failed, please retry',
      confirmPhrase: 'Confirm Operation',
      resetConfirmPhrase: 'Confirm Reset',
      importExport: {
        title: 'Import/Export',
        import: {
          title: 'Import Data',
          button: 'Import',
          selectFile: 'Select File',
          importing: 'Importing...',
          success: 'Data imported successfully',
          successDetail: 'Imported: {imported}, Skipped: {skipped}',
          failed: 'Import failed',
          confirm: 'Are you sure you want to import data? This will overwrite existing data!',
          details: {
            fileName: 'File name: {name}',
            fileSize: 'File size: {size} MB',
            autoBackup: 'A backup will be created automatically before import'
          },
          warnings: {
            override: 'Existing data may be overwritten',
            format: 'Please ensure the import file format is correct',
            backup: 'Recommend creating a manual backup first'
          }
        },
        export: {
          title: 'Export Data',
          button: 'Export',
          exporting: 'Exporting...',
          success: 'Data exported successfully',
          successDetail: 'File: {path}',
          failed: 'Export failed',
          confirm: 'Are you sure you want to export all data?',
          details: {
            all: 'Will export all decks and card data',
            records: 'Including study records and user settings',
            format: 'Generate JSON format export file'
          }
        }
      },
      backup: {
        title: 'Data Backup',
        latest: {
          title: 'Latest Backup',
          lastGenerated: 'Last Generated',
          dataFolder: 'Data Folder',
          justNow: 'Just now',
          stats: {
            totalSize: 'Total Size',
            deckCount: 'Deck Count',
            cardTotal: 'Card Total',
            backupCount: 'Backup Count'
          }
        },
        history: {
          title: 'Backup History',
          tableHeaders: {
            backupTime: 'Backup Time',
            backupType: 'Backup Type',
            backupSize: 'Backup Size',
            actions: 'Actions'
          },
          type: {
            manual: 'Manual',
            auto: 'Auto'
          },
          actions: {
            restore: 'Restore',
            delete: 'Delete',
            export: 'Export'
          }
        },
        operations: {
          integrityCheck: 'Integrity Check',
          exportData: 'Export Data',
          importData: 'Import Data',
          clearAll: 'Clear All',
          createBackup: 'Create Backup'
        },
        auto: {
          title: 'Auto Backup Configuration',
          description: 'Automatically create data backups periodically to protect your learning data',
          enable: 'Enable Auto Backup',
          enableDesc: 'Periodically create data backups automatically',
          interval: 'Backup Interval',
          intervalDesc: 'Time interval for automatic backups (1-168 hours)',
          intervalUnit: 'hours',
          triggers: {
            title: 'Trigger Conditions',
            onStartup: 'Backup on Startup',
            onStartupDesc: 'Automatically create backup when plugin starts',
            onCardThreshold: 'Backup on Card Threshold',
            onCardThresholdDesc: 'Automatically backup when card count changes reach threshold',
            thresholdCount: 'Threshold Count',
            thresholdCountDesc: 'Trigger backup when card count changes reach this value',
            thresholdUnit: 'cards'
          }
        },
        manual: {
          title: 'Manual Backup',
          label: 'Manual Backup',
          create: 'Backup Now',
          creating: 'Creating Backup...',
          success: 'Backup created successfully',
          successDetail: 'Size: {size} MB',
          failed: 'Failed to create backup'
        },
        list: {
          title: 'Backup List',
          description: 'All available backup records',
          loading: 'Loading...',
          colType: 'Type',
          colTime: 'Time',
          colDevice: 'Device',
          colContent: 'Content',
          colSize: 'Size',
          colTrigger: 'Trigger',
          colStatus: 'Status',
          colActions: 'Actions',
          globalBackup: 'Global Backup',
          cardCount: '{count} cards',
          compressed: 'Compressed {ratio}%',
          healthy: 'Healthy',
          unhealthy: 'Unhealthy',
          encrypted: 'Encrypted',
          details: 'Details',
          collapse: 'Collapse',
          restore: 'Restore',
          delete: 'Delete',
          confirmRestore: 'Are you sure you want to restore this backup? This will overwrite current data.',
          confirmRestoreTitle: 'Confirm Restore',
          confirmDelete: 'Are you sure you want to delete this backup? This action cannot be undone.',
          confirmDeleteTitle: 'Confirm Delete',
          triggerAutoImport: 'Auto (Import)',
          triggerAutoSync: 'Auto (Sync)',
          triggerManual: 'Manual',
          triggerScheduled: 'Scheduled',
          triggerPreUpdate: 'Pre-Update',
          triggerUnknown: 'Unknown',
          yesterday: 'Yesterday ',
          basicInfo: 'Basic Info',
          backupId: 'Backup ID:',
          pluginVersion: 'Plugin Version:',
          obsidianVersion: 'Obsidian Version:',
          vaultName: 'Vault Name:',
          notes: 'Notes',
          tags: 'Tags',
          fileInfo: 'File Info',
          storagePath: 'Storage Path:',
          backupType: 'Backup Type:',
          fullBackup: 'Full Backup',
          incrementalBackup: 'Incremental Backup',
          baseBackup: 'Base Backup:',
          prevPage: '\u2190 Previous',
          pageInfo: 'Page {current} / {total}',
          nextPage: 'Next \u2192'
        },
        mgmt: {
          statsTitle: 'Backup Statistics',
          statsDesc: 'Overall status of the backup system',
          totalBackups: 'Total Backups',
          totalSize: 'Total Size',
          compressedBackups: 'Compressed',
          deviceCount: 'Devices',
          creating: 'Creating...',
          createBackup: 'Create Backup',
          refreshing: 'Refreshing...',
          refresh: 'Refresh',
          loadFailed: 'Failed to load backup data',
          manualReason: 'User manually created backup',
          createSuccess: 'Backup created successfully',
          createFailed: 'Backup creation failed: ',
          restoreSuccess: 'Successfully restored {count} items',
          restoreFailed: 'Restore failed: ',
          deleted: 'Backup deleted',
          deleteFailed: 'Delete failed',
          deleteFailedDetail: 'Failed to delete backup: ',
          cleanupDone: 'Cleanup complete: {success} succeeded, {failed} failed',
          cleanupFailed: 'Batch cleanup failed: '
        }
      },
      notices: {
        fixFolderTitle: 'Fix Weave Folder',
        fixFolderMsg: 'Legacy data directory detected. Will merge to current parent folder and fix incremental reading path references.',
        fixComplete: 'Fix complete',
        fixFailed: 'Fix failed: ',
        moveFolderTitle: 'Move Weave Folder',
        moveFolderMsg: 'Will move the content folder to a new parent directory.',
        moveComplete: 'Weave folder location updated',
        moveFailed: 'Update failed: ',
        restoreTitle: 'Restore Backup',
        restoreMsg: 'Are you sure you want to restore data from this backup?',
        restoreSuccess: 'Data restored successfully\nFiles restored: {count}',
        restoreFailed: 'Restore failed',
        restoreFailedDetail: 'Restore failed: ',
        resetTitle: 'Reset All Data',
        resetMsg: 'This will permanently delete all data!',
        resetSuccess: 'Data reset successful\nCleared {count} records',
        resetFailed: 'Reset failed',
        resetFailedDetail: 'Reset failed: ',
        integrityPass: 'Data integrity check passed\nScore: {score}/100',
        integrityIssues: 'Found {count} critical issues\nScore: {score}/100',
        integrityResultTitle: 'Data Integrity Check Results',
        integrityResultMsg: 'Check score: {score}/100',
        integrityFailed: 'Integrity check failed',
        deleteBackupTitle: 'Delete Backup',
        deleteBackupMsg: 'Are you sure you want to delete this backup?',
        backupDeleted: 'Backup deleted',
        deleteBackupFailed: 'Failed to delete backup',
        repairSuccess: 'Successfully repaired {count} backups',
        repairFailed: 'Batch repair failed',
        cleanInvalidTitle: 'Clean Invalid Backups',
        cleanInvalidMsg: 'Are you sure you want to delete all invalid backups?',
        cleanInvalidFailed: 'Failed to clean invalid backups',
        backupPreviewTitle: 'Backup Preview',
        closeBtn: 'Close',
        corruptBackupsFound: 'Found {count} corrupt backups',
        corruptBackupsDesc: 'These backups may be missing required files or have corrupt metadata. Try auto-repair or clean up.',
        autoRepairAll: 'Auto Repair All',
        cleanupInvalid: 'Clean Invalid Backups',
        moreBackupsHint: '{count} more backups not shown',
        noBackupRecords: 'No backup records',
        selectBtn: 'Select'
      },
      weaveDataFolder: {
        title: 'Weave Local Data Folder',
        desc: 'This folder stores all plugin data locally, including memory decks, incremental reading, question banks, etc. It is critical — do not manually delete or move it.',
        locationLabel: 'Folder Location',
        irImportFolderLabel: 'Incremental Reading Import Folder',
        irImportFolderDesc: 'Imported files will be copied to this folder, original files remain unchanged'
      }
    },
    
    //  AnkiConnect Sync
    ankiConnect: {
      title: 'AnkiConnect Sync',
      sectionTitle: 'Anki Sync Settings',
      description: 'Connect to Anki desktop application for bidirectional card synchronization',
      enable: {
        label: 'Enable AnkiConnect',
        description: 'Connect to Anki desktop application for bidirectional card synchronization'
      },
      connection: {
        title: 'Connection Management',
        status: 'Connection Status',
        statusLabel: {
          connected: 'Connected',
          disconnected: 'Disconnected',
          testing: 'Testing...'
        },
        testConnection: 'Test Connection',
        address: {
          label: 'AnkiConnect Address',
          placeholder: 'http://localhost:8765',
          description: 'AnkiConnect API address'
        },
        test: {
          button: 'Test Connection',
          testing: 'Testing...',
          success: 'Connection Successful',
          failed: 'Connection Failed'
        },
        testing: 'Testing...',
        notTested: 'Not tested',
        connected: 'Connected',
        disconnected: 'Not connected',
        testButton: 'Test Connection',
        testingButton: 'Testing...',
        endpointLabel: 'AnkiConnect Endpoint',
        endpointDesc: 'AnkiConnect API address'
      },
      status: {
        title: 'Connection Status',
        connected: 'Connected',
        disconnected: 'Disconnected',
        syncing: 'Syncing...'
      },
      autoSync: {
        title: 'Auto Sync Configuration',
        enable: 'Enable Auto Sync',
        enableDesc: 'Automatically sync cards to Anki at set intervals',
        enableLabel: 'Enable Auto Sync',
        intervalLabel: 'Sync Interval (minutes)',
        intervalDesc: 'Time interval for scheduled sync',
        syncOnStartupLabel: 'Sync on Startup',
        syncOnStartupDesc: 'Automatically sync when Obsidian starts',
        fileWatcherLabel: 'File Change Detection',
        fileWatcherDesc: 'Automatically sync when card files are modified'
      },
      deckSync: {
        title: 'Deck Sync Configuration',
        enable: 'Enable Deck Sync',
        enableDesc: 'Synchronize deck data to Anki',
        description: 'Configure mapping between Weave decks and Anki decks',
        apiV6: 'Optional: Enable API v6',
        discovered: 'Discovered {count} Anki decks',
        configureMapping: 'Configure Mapping'
      },
      deckMapping: {
        neverSynced: 'Never synced',
        justNow: 'Just now',
        minutesAgo: '{n} min ago',
        hoursAgo: '{n} hours ago',
        daysAgo: '{n} days ago',
        importFromAnki: 'Import from Anki',
        exportToAnki: 'Export to Anki',
        bidirectionalSync: 'Bidirectional Smart Sync',
        deleteMapping: 'Delete Mapping',
        batchExportToAnki: 'Batch Export to Anki',
        batchImportFromAnki: 'Batch Import from Anki',
        batchBidirectionalSync: 'Batch Bidirectional Sync',
        noEnabledMappings: 'No enabled deck mappings',
        bidirectionalNotEnabled: 'Bidirectional sync not enabled, please enable in advanced settings',
        enabledCount: '{count} enabled',
        noWeaveDecks: 'No Weave Decks Found',
        noWeaveDecksHint: 'Please create at least one deck in the Deck Study view first, then refresh this page.',
        tableHeaders: {
          weaveDeck: 'Weave Deck',
          ankiDeck: 'Anki Deck',
          syncDirection: 'Sync Direction',
          contentConversion: 'Content Conversion',
          status: 'Status',
          lastSync: 'Last Sync',
          actions: 'Actions'
        },
        directions: {
          toAnki: 'To Anki',
          fromAnki: 'From Anki',
          bidirectional: 'Bidirectional'
        },
        contentOptions: {
          standard: 'Standard',
          preserveStyle: 'Preserve Styles',
          minimal: 'Minimal Conversion'
        },
        toggleEnable: 'Click to enable sync',
        toggleDisable: 'Click to disable sync',
        actionsMenu: 'Actions menu',
        moreActions: 'More actions',
        help: {
          title: 'Usage Guide',
          closeHelp: 'Close help',
          mappingCount: '{count} mappings configured',
          mappingCountDesc: 'Toggle the switch to enable sync, click sync button to execute',
          howToUse: 'How to Use',
          howToUseItems: [
            'Enable Sync: Toggle the switch in the table to enable or disable a mapping',
            'Single Sync: Click the actions menu (...) to choose sync direction',
            'Batch Sync: Click the top-right menu (...) to batch operate all enabled mappings'
          ],
          syncDirections: 'Sync Direction Guide',
          syncDirectionItems: [
            '-> To Anki: Export Weave cards to Anki',
            '<- From Anki: Import cards from Anki to Weave',
            '<-> Bidirectional: Smart bidirectional sync (requires premium activation)'
          ],
          gotIt: 'Got it'
        }
      },
      sectionSync: {
        title: 'Section Sync Configuration',
        enable: 'Enable Section Sync',
        enableDesc: 'Synchronize section content to Anki'
      },
      syncProgress: {
        processing: 'Processing:',
        deckProgress: 'Deck progress:',
        cancelLabel: 'Cancel operation',
        cancelButton: 'Cancel'
      },
      addMapping: {
        title: 'Add New Deck Mapping',
        weaveDeckLabel: 'Weave Deck',
        weaveDeckPlaceholder: 'Select Weave deck...',
        ankiDeckLabel: 'Anki Deck',
        ankiDeckPlaceholder: 'Select Anki deck...',
        syncDirectionLabel: 'Sync Direction',
        contentConversionLabel: 'Content Conversion',
        addButton: 'Add'
      },
      toolbar: {
        fetching: 'Fetching...',
        fetchAnkiDecks: 'Fetch Anki Deck List',
        deckCount: 'Discovered {count} Anki decks',
        createWeaveFirst: 'Please create a Weave deck first',
        fetchAnkiFirst: 'Please fetch Anki deck list first',
        cancelAdd: 'Cancel',
        addMapping: 'Add Mapping'
      },
      advanced: {
        mediaSyncLabel: 'Enable Media Sync',
        mediaSyncDesc: 'Sync images, audio, and other media files to Anki'
      },
      notices: {
        connectSuccess: 'Connected! Anki is running',
        connectHint: 'Click "Fetch Anki Deck List" to start configuring',
        connectFailed: 'Connection failed: ',
        connectTestFailed: 'Connection test failed: ',
        pleaseTestFirst: 'Please test connection first',
        dataRefreshed: 'Deck data refreshed',
        refreshFailed: 'Failed to refresh data: ',
        fetchedDecks: 'Fetched {count} Anki decks, please add mappings manually',
        fetchDecksFailed: 'Failed to fetch decks: ',
        fetchedModels: 'Fetched {count} templates',
        fetchModelsFailed: 'Failed to fetch templates: ',
        mappingExists: 'Mapping already exists: {name}',
        mappingAdded: 'Mapping added: {weave} ⇄ {anki}',
        pleaseInitFirst: 'Please click "Test Connection" to initialize',
        mappingNotFound: 'Deck mapping not found',
        bidirectionalSyncing: 'Bidirectional syncing "{name}"...',
        importWarnings: '{count} warnings, please check console',
        importFailed: 'Import failed: ',
        noEnabledMappings: 'No enabled deck mappings',
        batchFailed: 'Batch processing failed: ',
        startupFailed: 'Startup failed: ',
        saveFailed: 'Failed to save settings',
        dataExpired: 'Deck data may be outdated, consider refreshing',
        copiedToClipboard: 'Copied to clipboard',
        copyBtn: 'Copy',
        syncingCards: 'Syncing cards',
        importingCards: 'Importing cards',
        preparing: 'Preparing...',
        processing: 'Processing...',
        exportToAnkiTitle: 'Export to Anki',
        importFromAnkiTitle: 'Import from Anki',
        bidirectionalSyncTitle: 'Bidirectional Smart Sync',
        syncComplete: '"{name}" sync complete!\nExported: {exported} | Skipped: {skipped}',
        syncFailed: 'Sync failed',
        ankiNotRunning: 'Anki is not running, please start Anki first',
        deckNotAccessible: 'Deck does not exist or is not accessible',
        importingFromAnki: 'Importing from Anki...',
        exportingToAnki: 'Exporting to Anki...',
        importPrefix: 'Import: ',
        exportPrefix: 'Export: ',
        bidirectionalComplete: '"{name}" bidirectional sync complete!\nImported: {imported} | Exported: {exported}\nSkipped: {skipped}',
        bidirectionalFailed: 'Bidirectional sync failed',
        importComplete: 'Import complete!\nCards: {cards}\nTemplates: {templates}\nSkipped: {skipped}',
        exportFailed: 'Export failed',
        importFailedError: 'Import failed',
        batchExportTitle: 'Batch Export to Anki',
        batchImportTitle: 'Batch Import from Anki',
        batchBidirectionalTitle: 'Batch Bidirectional Sync',
        batchComplete: 'Batch processing complete!\nSuccess: {success}/{total} decks | Total cards: {cards}',
        batchCompleteWithErrors: 'Batch processing complete (with errors)\nSuccess: {success} | Failed: {failed}\nSee console for details',
        settingsSaved: 'AnkiConnect settings saved',
        serviceStarted: 'AnkiConnect service started',
        serviceStopped: 'AnkiConnect service stopped',
        fetchModelsTitle: 'Fetch Anki Templates',
        testing: 'Testing...',
        notTested: 'Not tested',
        connected: 'Connected',
        disconnected: 'Not connected',
        corsTitle: 'AnkiConnect CORS Configuration',
        corsDesc: 'In Anki, go to Tools → Add-ons → AnkiConnect → Config, and add "app://obsidian.md" to the webCorsOriginList array, otherwise card sync will not work properly.'
      },
      syncLog: {
        title: 'Sync Log',
        description: 'Recent sync records',
        totalSyncs: 'Total Syncs',
        success: 'Success',
        failed: 'Failed',
        successRate: 'Success Rate',
        tableHeaders: {
          time: 'Time',
          direction: 'Direction',
          success: 'Success',
          failed: 'Failed',
          skipped: 'Skipped',
          duration: 'Duration'
        },
        yesterday: 'Yesterday',
        seconds: 's',
        minuteSeconds: '{min}m{sec}s',
        prevPage: '\u2190 Previous',
        nextPage: 'Next \u2192',
        pageInfo: 'Page {current} / {total}',
        clearLogs: 'Clear Logs'
      }
    },
    
    // Incremental Reading Settings
    irSettings: {
      importTitle: 'Import Settings',
      importFolderLabel: 'Import Material Storage Folder',
      importFolderDesc: 'Imported PDF/EPUB files will be copied to this folder; Markdown files are used in place and are not duplicated',
      selectBtn: 'Select',
      scheduleTitle: 'Deck Scheduling',
      dailyNewLabel: 'Daily New Blocks Limit',
      dailyNewDesc: 'Maximum number of new content blocks to learn per day',
      dailyReviewLabel: 'Daily Review Limit',
      dailyReviewDesc: 'Maximum number of content blocks to review per day',
      learnAheadLabel: 'Look-Ahead Days',
      learnAheadDesc: 'Content blocks due within N days are shown as "pending" and can be read ahead',
      intervalFactorLabel: 'Interval Growth Factor',
      intervalFactorDesc: 'Multiplier for interval days after each review',
      reviewThresholdLabel: 'Review Threshold (days)',
      reviewThresholdDesc: 'Enter review state when interval reaches this many days',
      maxIntervalLabel: 'Maximum Interval (days)',
      maxIntervalDesc: 'Upper limit for review intervals in days',
      splitTitle: 'Content Splitting',
      splitLevelLabel: 'Default Split Level',
      splitLevelDesc: 'Split imported files by heading level (1-6 corresponds to # through ######)',
      strategyTitle: 'Scheduling Strategy',
      strategyLabel: 'Scheduling Strategy',
      strategyDesc: 'Choose a scheduling mode that fits your reading habits',
      timeBudgetLabel: 'Daily Time Budget',
      timeBudgetDesc: 'Planned daily time for incremental reading',
      maxAppearancesLabel: 'Block Daily Limit',
      maxAppearancesDesc: 'Maximum times the same block can appear per day (anti-spam)',
      advancedTitle: 'Advanced Scheduling',
      tagGroupPriorLabel: 'Enable Tag Group Prior',
      tagGroupPriorDesc: 'Automatically adjust interval growth factor based on material type',
      tagGroupFollowLabel: 'Tag Group Auto-Follow',
      tagGroupFollowDesc: 'Automatically detect and switch to matching tag group when document tags change',
      agingStrengthLabel: 'Anti-Sink Strength',
      agingStrengthDesc: 'Priority boost intensity for long-unread content',
      postponeLabel: 'Overload Auto-Postpone',
      postponeDesc: 'Automatically postpone low-priority content when too many items are due',
      priorityHalfLifeLabel: 'Priority Smoothing Half-Life',
      priorityHalfLifeDesc: 'Smoothness of priority changes (more days = smoother)',
      interleaveTitle: 'Interleaved Learning',
      interleaveModeLabel: 'Enable Interleaved Learning',
      interleaveModeDesc: 'Mix content blocks from different decks/topics to improve learning',
      maxConsecutiveLabel: 'Max Consecutive Same-Topic',
      maxConsecutiveDesc: 'Force switch to another topic after this many consecutive blocks',
      unitBlocks: 'blocks',
      unitMinutes: 'min',
      unitTimes: 'times',
      unitDays: 'days',
      calloutSignalTitle: 'Callout Signals',
      calloutSignalLabel: 'Enable Callout Signals',
      calloutSignalDesc: 'Use Callout annotations to influence content block scheduling priority',
      calloutTypeWeightsLabel: 'Callout Type Weights',
      calloutTypeWeightsDesc: 'Select callout types for scheduling and configure weights (0.5~3.0)',
      deleteBtn: 'Delete',
      calloutTypePlaceholder: 'Enter Callout type name',
      addBtn: 'Add',
      maxBoostLabel: 'Max Boost',
      maxBoostDesc: 'Maximum priority correction from annotations (1.0~2.0)',
      saturationLabel: 'Saturation Speed',
      saturationDesc: 'Saturation speed of annotation count boost (smaller = faster saturation, prevents annotation spamming)',
      strategyHintReadingList: 'Reading List mode: each block appears at most once per day, ideal for light browsing and extensive reading',
      strategyHintProcessing: 'Processing mode: same content can be revisited multiple times per day, ideal for deep processing, excerpting and card-making',
      followOff: 'Off',
      followOffDesc: 'Fixed after import, no changes',
      followAsk: 'Ask',
      followAskDesc: 'Notify for confirmation when change detected',
      followAuto: 'Auto',
      followAutoDesc: 'Silently auto-switch tag group',
      minContentLabel: 'Min Content Threshold',
      minContentDesc: 'Callout content below this character count is not counted (0=disabled)',
      unitChars: 'chars',
      algorithmHintTitle: 'Algorithm Notes',
      algorithmHintContent: 'The first few annotations provide significant boost, then returns diminish. The final correction is clamped to [0, maxBoost].',
      strategyProcessingLabel: 'Processing',
      strategyProcessingDesc: 'Revisit same content multiple times per day, ideal for deep processing',
      strategyReadingListLabel: 'Reading List',
      strategyReadingListDesc: 'Each block appears at most once per day, ideal for light browsing',
      agingLowLabel: 'Low',
      agingLowDesc: 'Slowly boost priority for long-unread content',
      agingMediumLabel: 'Medium',
      agingMediumDesc: 'Moderate anti-sink',
      agingHighLabel: 'High',
      agingHighDesc: 'Aggressively prevent content from being forgotten',
      postponeOffLabel: 'Off',
      postponeOffDesc: 'No auto-postpone',
      postponeGentleLabel: 'Gentle',
      postponeGentleDesc: 'Only postpone low-priority content',
      postponeAggressiveLabel: 'Aggressive',
      postponeAggressiveDesc: 'More content postponed to control load'
    },
    // Incremental Reading Tag Groups
    irTagGroup: {
      cannotDeleteDefault: 'Cannot delete the default tag group',
      deleteConfirm: 'Are you sure you want to delete tag group "{name}"?\nDocuments in this group will be moved to the default group.',
      deleted: 'Tag group "{name}" deleted',
      deleteFailed: 'Delete failed',
      saveFailed: 'Save failed: ',
      tagExists: 'Tag already exists',
      nameRequired: 'Please enter a tag group name',
      tagRequired: 'Please add at least one matching tag',
      updated: 'Tag group "{name}" updated',
      created: 'Tag group "{name}" created',
      managerTitle: 'Material Type Tag Groups',
      managerDesc: 'Group reading materials by tags, each group can learn independent scheduling rhythm parameters',
      createBtn: 'New Tag Group',
      loading: 'Loading...',
      loadFailed: 'Load failed: ',
      retryBtn: 'Retry',
      colName: 'Name',
      colTags: 'Tags',
      colDocs: 'Docs',
      colFactor: 'Interval Factor',
      colSamples: 'Samples',
      colPriority: 'Priority',
      colActions: 'Actions',
      defaultGroupHint: 'Documents not matching any tag group will use default group parameters',
      editor: {
        nameLabel: 'Tag Group Name',
        nameHint: 'A name to identify this type of reading material',
        tagsLabel: 'Matching Tags',
        tagsHint: 'Documents with any of these tags will be assigned to this group',
        matchSourceLabel: 'Match Source',
        matchSourceHint: 'Choose where to extract tags from documents for matching',
        inlineTags: 'Inline #tags',
        customYaml: 'Custom YAML Properties',
        priorityLabel: 'Match Priority',
        priorityHint: 'Lower values mean higher priority. When a document matches multiple groups, it is assigned to the highest priority group.',
        algorithmNoteTitle: 'Scheduling Parameters',
        algorithmNoteContent: 'After creating a tag group, the system initializes default scheduling parameters (interval factor=1.5). As learning accumulates for documents in this group, parameters gradually adapt to the optimal rhythm for this type of material through shrinkage learning.',
        cancelBtn: 'Cancel',
        saveBtn: 'Save',
        createBtn: 'Create'
      },
      stats: {
        title: 'Parameter Learning Statistics',
        intervalFactor: 'Interval Factor',
        coldStartMultiplier: 'Cold Start Multiplier',
        sampleCount: 'Learning Samples',
        lastUpdated: 'Last Updated',
        trendTitle: 'Trend',
        noHistory: 'No history data',
        noHistoryHint: 'Trends will be displayed here after parameter learning',
        paramNoteTitle: 'Parameter Notes',
        paramNoteContent: 'The interval factor determines how fast review intervals grow. Higher values mean faster growth. The system automatically adjusts this parameter based on reading feedback to adapt to this type of material.',
        closeBtn: 'Close'
      }
    },
    // FSRS6 Algorithm
    fsrs6Notices: {
      optimizationApplied: 'Optimization parameters applied',
      optimizationRejected: 'Optimization suggestion rejected, keeping current parameters',
      dataRefreshed: 'Optimization data refreshed, review records: {count}',
      loadingData: 'Loading optimization data...',
      historyTitle: 'Optimization History',
      historyCount: '{count} records',
      colStatus: 'Status',
      colTime: 'Time',
      colPhase: 'Phase',
      colReviews: 'Reviews',
      colAccuracy: 'Accuracy',
      colChanges: 'Changes',
      colNote: 'Note',
      noChanges: 'No changes',
      paramCount: '{count} parameters',
      serviceNotReady: 'Optimization service not initialized. Please try again later or reload the plugin.',
      insufficientData: 'Insufficient data. At least 50 review records are needed for optimization, currently only {count} reviews.',
      optimizationFailed: 'Parameter optimization failed: ',
      statusAccepted: 'Accepted',
      statusRejected: 'Rejected'
    },
    // License
    licenseNotices: {
      resetConfirm: 'Are you sure you want to reset the license? This will clear the current activation status.',
      sectionTitle: 'License Status',
      verifySuccess: 'License verified successfully',
      verifyFailed: 'License verification failed',
      verifyFailedDetail: 'License verification failed: {error}',
      resetSuccess: 'License has been reset'
    },

    //  Performance Optimization
    virtualization: {
      title: 'Performance Optimization',
      description: 'Configure virtual scrolling and rendering optimization to improve performance with large card sets',
      resetConfirm: 'Are you sure you want to reset all virtualization settings to default?',
      resetButton: 'Reset to Default',
      kanban: {
        title: 'Kanban View Settings',
        enableVirtualScroll: {
          label: 'Enable Virtual Scrolling',
          description: 'Enable virtual scrolling within kanban columns to greatly improve performance with large card sets (recommended for >200 cards)'
        },
        enableColumnVirtualization: {
          label: 'Column Virtualization',
          description: 'Enable virtual scrolling for each column individually (progressive loading still available when disabled)'
        },
        overscan: {
          label: 'Overscan Count',
          description: 'Number of cards to pre-render outside viewport, increase to reduce white screen during scrolling but uses more memory'
        },
        initialBatchSize: {
          label: 'Initial Load Count',
          description: 'Number of cards to initially load per column (effective in non-virtualization mode)'
        },
        loadMoreBatchSize: {
          label: 'Batch Load Count',
          description: 'Number of cards to load at once when clicking "Load More"'
        }
      },
      table: {
        title: 'Table View Settings',
        enableVirtualScroll: {
          label: 'Enable Virtual Scrolling',
          description: 'Enable virtual scrolling in table view (currently defaults to pagination)'
        },
        enableTableVirtualization: {
          label: 'Enable Table Virtualization',
          description: 'Enable virtual scrolling for table rows (requires virtual scrolling enabled first)'
        },
        paginationThreshold: {
          label: 'Pagination Threshold',
          description: 'Use pagination instead of virtual scrolling below this count (recommended: 500)'
        }
      },
      advanced: {
        title: 'Advanced Options',
        cacheItemHeight: {
          label: 'Cache Measured Heights',
          description: 'Cache measured card heights to improve performance (recommended)'
        },
        estimatedItemHeight: {
          label: 'Estimated Item Height',
          description: 'Initial height estimate for virtual scrolling (pixels)'
        },
        resetSettings: {
          label: 'Reset Settings',
          description: 'Reset all virtualization settings to default values'
        }
      },
      tips: {
        title: 'Performance Optimization Tips',
        tip1: 'Virtual scrolling automatically enables when card count exceeds 200, no manual intervention needed',
        tip2: 'Increasing Overscan reduces white screen during scrolling but increases memory usage',
        tip3: 'Pagination mode is recommended for table view unless you need quick browsing of large datasets',
        tip4: 'Enabling height cache significantly improves scrolling performance with minimal memory cost'
      }
    },
    
    //  Deck Views
    decks: {
      dashboard: {
        emptyHint: 'No decks in this category. You can assign categories when creating new decks',
        unit: 'cards',
        study: 'Study',
        completed: 'Done',
        startStudy: 'Start Study',
        viewCelebration: 'View Celebration',
        heatmapTitle: 'Deck Heatmap',
        filterParent: 'Parent Decks',
        filterChild: 'Child Decks',
        filterAll: 'All Decks',
        categoryRequired: 'At least one category is required',
        categoryUpdated: 'Category updated',
        durationMinutes: '{n}min',
        durationZero: '0min',
        moreActions: 'More Actions'
      },
      card: {
        ariaLabel: 'Deck: {name}',
        new: 'New',
        learning: 'Learn',
        review: 'Rev',
        // Elegant style card full labels
        newFull: 'New',
        learningFull: 'Learning',
        reviewFull: 'Review',
        moreActions: 'More Actions',
        irUnread: 'Unread',
        irPending: 'Pending',
        irQuestions: 'Questions',
      },
      // Question bank cards
      questionBank: {
        total: 'Total',
        completed: 'Done',
        errors: 'Errors',
        empty: 'No questions'
      },
      grid: {
        emptyText: 'No decks in this category',
        emptyHint: 'You can assign categories when creating new decks',
        parentDeck: 'Parent Card Deck',
        childDeck: 'Child Card Deck',
        readingTitle: 'Incremental Reading',
        readingDesc: 'Incremental reading has been integrated into the left sidebar',
      },
      menu: {
        advanceStudy: 'Advance Study',
        deckAnalytics: 'Deck Analytics',
        createSubdeck: 'Create Subdeck',
        moveDeck: 'Move Deck',
        moveCategory: 'Move Category',
        editDeck: 'Edit Deck',
        edit: 'Edit',
        delete: 'Delete',
        refreshData: 'Refresh Data'
      },
      categoryFilter: {
        incrementalReading: 'Incremental Reading',
        memory: 'Memory Decks',
        questionBank: 'Exam Decks',
      },
      viewSwitcher: {
        table: 'Table View',
        grid: 'Grid View',
        kanban: 'Kanban View',
      },
      progressBar: {
        ariaLabel: '{deckName} progress: {new} new, {learning} learning, {review} review, {mastered} mastered',
        empty: 'No cards',
      },
      timeline: {
        today: 'Today',
        urgent: 'Urgent',
        normal: 'Normal',
        completed: 'Completed',
        cards: 'cards',
        startTodayStudy: 'Start Today\'s Study',
        thisWeek: 'This Week',
        thisMonth: 'This Month',
        monthCompleted: 'Monthly Completed',
        monthNew: 'Monthly New',
        studyDuration: 'Study Duration',
        studyTimeHours: '{n} hrs',
        monthAchievements: 'Monthly Achievements',
        streak: 'Study Streak',
        streakDays: '{n} days',
        completionRate: 'Completion Rate',
        weekDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      },
      knowledgeMap: {
        title: 'Knowledge Map',
        subtitle: 'Systematic Learning Path - From Foundation to Expert',
        overviewTitle: 'Learning Progress Overview',
        legendCompletion: 'Completion Rate',
        legendMastery: 'Retention Rate',
        deckCount: '{n} decks',
        changeLevel: 'Change Knowledge Level',
        uncategorized: 'Uncategorized',
        levelFoundation: 'Foundation',
        levelIntermediate: 'Intermediate',
        levelAdvanced: 'Advanced',
        levelExpert: 'Expert',
        emptyTitle: 'No knowledge map decks yet',
        emptyDesc: 'Include keywords like "basic", "intermediate", "advanced", or "expert" in deck names to auto-organize them into levels.',
      },
      tagGroupCreator: {
        titleCreate: 'Create Tag Group',
        titleEdit: 'Edit Tag Group',
        nameLabel: 'Tag Group Name',
        namePlaceholder: 'e.g., Circulatory System, Frontend Dev',
        tagsLabel: 'Included Tags',
        tagInputPlaceholder: 'Type a tag and press Enter to add',
        tagHint: 'Select from existing deck tags, or enter a new tag',
        tagExists: 'Tag already exists',
        nameRequired: 'Please enter a tag group name',
        tagRequired: 'Please add at least one tag',
        cancel: 'Cancel',
        save: 'Save',
        create: 'Create',
      },
      statsPopover: {
        ariaLabel: 'Deck Statistics',
        close: 'Close',
        closeEsc: 'Close (Esc)',
        newCards: 'New Cards',
        learning: 'Learning',
        review: 'Due for Review',
        mastered: 'Mastered',
        unit: '',
        memoryRate: 'Retention Rate',
        todayStudy: 'Today',
        minutes: 'min',
        lessThan1Min: '< 1min',
        zeroMin: '0min',
      },
      kanban: {
        noTag: 'No Tag',
        tagGrouping: 'Tag Grouping',
        other: 'Other',
        tagGroupPrefix: 'Tag Group: {name}',
        tagGroupUpdated: 'Tag group "{name}" updated',
        tagGroupCreated: 'Tag group "{name}" created',
        tagGroupDeleteConfirm: 'Are you sure you want to delete tag group "{name}"?',
        confirmDelete: 'Confirm Delete',
        tagGroupDeleted: 'Tag group "{name}" deleted',
        startReading: 'Start Reading',
        advanceReading: 'Advance Reading',
        advanceReadingFailed: 'Advance reading failed',
        editDeck: 'Edit Deck',
        deckAnalytics: 'Deck Analytics',
        dissolveDeck: 'Dissolve Deck',
        dissolveConfirmIR: 'The deck will be deleted after dissolving, but content block data will be preserved. Continue?',
        deckDissolved: 'Deck dissolved (content block data preserved)',
        dissolveFailed: 'Failed to dissolve deck',
        deleteDeck: 'Delete Deck',
        analytics: 'Analytics',
        qbServiceNotInit: 'Question bank service not initialized',
        qbNotFound: 'Question bank not found',
        openAnalyticsFailed: 'Failed to open analytics',
        grouping: 'Grouping...',
        emptyColumn: 'No decks',
        groupLabel: '{label} group',
        kanbanSettings: 'Kanban Settings',
        viewOptions: 'View Options',
        groupByLabel: 'Group By',
        tagGroup: 'Tag Group',
        selectPlaceholder: '-- Select --',
        createNew: 'New',
        newTagGroup: 'New Tag Group',
        editTagGroup: 'Edit Tag Group',
        deleteTagGroup: 'Delete Tag Group',
        hideEmptyGroups: 'Hide Empty Groups',
        groups: 'Groups',
        reset: 'Reset',
        showAll: 'Show all columns',
        hideAll: 'Hide all columns',
        showAllBtn: 'Show All',
        hideAllBtn: 'Hide All'
      }
    },
    
    //  Study Info Panel
    studyInfo: {
      fsrs: {
        title: 'FSRS Algorithm Info',
        version: 'FSRS 5/6',
        description: 'FSRS (Free Spaced Repetition Scheduler) is a memory model-based spaced repetition algorithm that can more accurately predict forgetting time and optimize review intervals.'
      },
      today: {
        title: "Today's Study",
        unit: 'cards',
        studied: 'Studied',
        new: 'New',
        review: 'Review',
        reviewCount: 'Review Count'
      },
      smartTips: {
        title: 'Smart Tips',
        shortMemory: 'Smart Short Memory',
        forgetPredict: 'Forget Prediction Optimization',
        sameDayOptimize: 'Same-day Review Optimization'
      },
      currentCard: {
        title: 'Current Card',
        type: 'Type',
        reps: 'Reviews',
        lapses: 'Lapses'
      }
    },
    
    //  Vertical Toolbar
    toolbar: {
      unknownDeck: 'Unknown Deck',
      sourceNotFound: 'Source document not found',
      sourceNotExist: 'Source document does not exist',
      blockNotFound: 'Block link not found',
      sourceDeleted: 'Source document has been deleted',
      jumpedToSource: 'Jumped to source document',
      openedSource: 'Opened source document',
      noSourceLinked: 'This card is not linked to a source document',
      sourceDoc: 'Source Document',
      currentCard: 'Current Card',
      saveAndPreview: 'Save & Preview',
      editCard: 'Edit Card',
      preview: 'Preview',
      edit: 'Edit',
      plainTextEditor: 'Plain Text Editor',
      textEdit: 'Text Edit',
      deleteCard: 'Delete Card',
      delete: 'Delete',
      setReminder: 'Set Reminder',
      reminder: 'Reminder',
      setPriority: 'Set Priority',
      priority: 'Priority',
      changeDeck: 'Change Deck',
      deck: 'Deck',
      deckList: 'Deck List',
      currentDeck: 'Current Deck',
      availableDecks: 'Available Decks',
      viewCardInfo: 'View Card Info & Source',
      cardInfoAndSource: 'Card Info & Source',
      belongToDeck: 'Belongs to Deck',
      cardState: 'Card State',
      stateNew: 'New',
      stateLearning: 'Learning',
      stateReview: 'Review',
      stateRelearning: 'Relearning',
      stateUnknown: 'Unknown',
      graphLink: 'Graph Link',
      graphLinkEnabled: 'Disable Graph Link',
      graphLinkDisabled: 'Enable Graph Link',
      graphLinkSuccess: 'Graph link enabled\nGraph will auto-update when switching cards',
      graphLinkClosed: 'Graph link disabled',
      noSourceFile: 'Current card has no source file',
      sourceFileNotExist: 'Source file does not exist',
      graphLinkInitFailed: 'Failed to initialize graph link',
      blockJumpFailed: 'Jump failed',
      noDecksAvailable: 'No decks available',
      setCardDeck: 'Set card deck',
      noSourceDoc: 'This card has no linked source document',
      sourceDocDeleted: 'Source document does not exist or has been deleted',
      blockRefNotFound: 'Block reference ^{blockId} not found',
      readSourceFailed: 'Failed to read source document',
      copiedSourceBlock: 'Source block content copied',
      openedEpub: 'Opened EPUB source document',
      studyViewNotFound: 'Study view not found',
      avgTime: 'Avg Time',
      longPressDrag: 'Long press to drag and reorder',
      directDeleteCard: 'Delete card directly',
      removeFromDeck: 'Remove from current deck (keep card data)',
      remove: 'Remove',
      aiAssistant: 'AI Assistant',
      hasSourceDoc: 'Has source document',
      noSourceDocShort: 'No source document',
      sourceIndicatorTip: 'This card has a source document, view local knowledge graph',
      openInfoMenu: 'Open card details and source menu',
      view: 'View',
      basicInfo: 'Basic Info',
      cardId: 'Card ID',
      cardRelation: 'Card Relation',
      childCard: 'Child Card',
      parentCard: 'Parent Card',
      independentCard: 'Independent',
      containCards: '{n} cards',
      studyData: 'Study Data',
      stability: 'Stability',
      difficulty: 'Difficulty',
      interval: 'Interval',
      totalReviews: 'Total Reviews',
      timesUnit: '{n} times',
      secondsUnit: '{n}s',
      memoryRate: 'Memory Rate',
      unknown: 'Unknown',
      formatError: 'Format Error',
      lessThanOneDay: 'Less than 1 day',
      daysUnit: '{n} days',
      monthsUnit: '{n} months',
      yearsUnit: '{n} years',
      timeInfo: 'Time Info',
      createdTime: 'Created',
      modifiedTime: 'Modified',
      nextReview: 'Next Review',
      sourceInfo: 'Source Info',
      noSource: 'No Source',
      blockRef: 'Block Ref',
      viewDetails: 'View Details',
      viewDataStructure: 'View Data Structure',
      viewDataStructureTitle: 'View full card data structure (JSON format)',
      viewSourceBlock: 'View source block',
      viewSourceBlockAria: 'View source block text',
      sourceText: 'Source',
      sourceBlockTitle: 'Source Block',
      loadingSourceBlock: 'Loading source block...',
      unknownFile: 'Unknown file',
      sourceBlockLabel: 'Source',
      emptyContent: '(Empty)',
      jumpToSource: 'Jump to Source',
      jumpToSourceTitle: 'Open source document in Obsidian and navigate to this block',
      copyContent: 'Copy Content',
      copyContentTitle: 'Copy source block content to clipboard',
      moreSettings: 'More Settings',
      more: 'More',
      autoPlayMedia: 'Auto Play Media',
      playMode: 'Play Mode',
      playFirst: 'First Only',
      playAllMedia: 'Play All',
      playTiming: 'Play Timing',
      onCardChange: 'Card Change',
      onShowAnswer: 'Show Answer',
      playInterval: 'Play Interval',
      cardOrder: 'Card Order',
      sequential: 'Sequential',
      random: 'Random',
      timeoutPause: 'Timeout Pause',
      enableDirectDelete: 'Enable Direct Delete',
      showTutorialBtn: 'Show Tutorial Button',
      recycleCardLabel: 'Recycle Card: #recycle',
      recycleCardTitle: 'Recycle current card, temporarily remove from study queue',
      clickApply: 'Apply',
      viewTutorial: 'View Tutorial',
      tutorial: 'Tutorial',
      tutorialTitle: 'Tutorial',
      moreMenu: 'More ▾',
      tabCore: 'Core Features',
      tabBasics: 'Basic Formats',
      tabAI: 'AI Assistant',
      tabProgressive: 'Progressive Cloze',
      tabPriority: 'Card Priority',
      tabQueue: 'Study Queue',
    },
    
    //  Modals
    modals: {
      viewCard: {
        title: 'Card Details',
        tabInfo: 'Card Info',
        tabStats: 'Review Stats',
        tabCurve: 'Memory Curve',
        loading: 'Loading...',
        unknownTemplate: 'Unknown Template',
        noDeck: 'No Deck'
      },
      moveDeck: {
        title: 'Move Deck',
        moveToNew: 'Move {name} to new location',
        searchPlaceholder: 'Search target deck...',
        selectTarget: 'Select Target Location',
        rootOption: 'Top Level (No Parent)',
        rootDesc: 'Upgrade to root deck',
        moveToRoot: 'Move to top level',
        cancel: 'Cancel',
        confirm: 'Confirm Move'
      },
      saveFilter: {
        title: 'Save Filter',
        name: 'Name',
        namePlaceholder: 'Enter filter name',
        nameError: 'Please enter filter name',
        nameTooLong: 'Name cannot exceed 50 characters',
        description: 'Description',
        descriptionPlaceholder: 'Optional',
        icon: 'Icon',
        color: 'Color',
        pinToSidebar: 'Pin to Sidebar',
        cancel: 'Cancel',
        save: 'Save',
        iconFilter: 'Filter',
        iconStar: 'Star',
        iconBookmark: 'Bookmark',
        iconTag: 'Tag',
        iconHeart: 'Heart',
        iconFlag: 'Flag',
        iconCircleDot: 'Circle Dot',
        iconCheckCircle: 'Check Circle',
        iconClock: 'Clock',
        iconCalendar: 'Calendar',
        iconBook: 'Book',
        iconLayers: 'Layers',
        colorBlue: 'Blue',
        colorTheme: 'Theme Color',
        colorPink: 'Pink',
        colorRed: 'Red',
        colorOrange: 'Orange',
        colorGreen: 'Green',
        colorCyan: 'Cyan',
        colorGray: 'Gray'
      },
      batchAddTags: {
        title: 'Batch Add Tags',
        inputPlaceholder: 'Enter tags and press Enter...',
        suggestions: 'Suggestions',
        cancel: 'Cancel',
        confirm: 'Confirm Add'
      },
      batchRemoveTags: {
        title: 'Batch Remove Tags',
        info: 'Remove tags from {count} selected cards',
        selectAll: 'Select All',
        clearAll: 'Clear All',
        noTags: 'Selected cards have no tags',
        cancel: 'Cancel',
        confirm: 'Confirm Delete'
      },
      batchDeckChange: {
        title: 'Batch Change Deck',
        operationType: 'Select operation type:',
        move: 'Move',
        moveDesc: 'Move {count} cards to new deck',
        copy: 'Copy',
        copyDesc: 'Copy {count} cards to new deck (keep originals)',
        searchPlaceholder: 'Search decks...',
        selectDeck: 'Select deck: {name}',
        cancel: 'Cancel',
        confirm: 'Confirm'
      },
      cardInfoTab: {
        copyUUID: 'UUID copied to clipboard',
        noSource: 'This card has no linked source document',
        sourceDeleted: 'Source document has been deleted',
        jumpedToSource: 'Jumped to source document',
        openedSource: 'Opened source document',
        basicInfo: 'Basic Information',
        uuid: 'UUID',
        deckLabel: 'Deck',
        templateLabel: 'Template',
        createdAt: 'Created',
        updatedAt: 'Last Edited',
        sourceInfo: 'Source Information',
        sourceFile: 'Source File',
        sourceBlock: 'Source Block',
        notLinked: 'Not Linked',
        viewSource: 'View Source',
        tags: 'Tags',
        noTags: 'No Tags',
        customFields: 'Custom Fields',
        noCustomFields: 'No Custom Fields'
      },
      reviewStatsTab: {
        coreMetrics: 'Core Metrics',
        totalReviews: 'Total Reviews',
        lapses: 'Lapses',
        successRate: 'Success Rate',
        avgResponseTime: 'Avg Response Time',
        times: 'times',
        seconds: 'sec',
        fsrsMetrics: 'FSRS Metrics',
        stability: 'Stability',
        difficulty: 'Difficulty',
        retrievability: 'Retrievability',
        days: 'days',
        reviewHistory: 'Review History',
        noHistory: 'No review records yet',
        schedulingInfo: 'Scheduling Info',
        currentInterval: 'Current Interval',
        nextReview: 'Next Review',
        notScheduled: 'Not Scheduled'
      },
      memoryCurveTab: {
        title: 'Memory Curve',
        description: 'Memory curve visualization',
        noData: 'No data available',
        timeRange: 'Time Range:',
        range7d: '7 Days',
        range30d: '30 Days',
        range90d: '90 Days',
        rangeAll: 'All',
        legend: {
          predicted: 'Predicted - Theoretical forgetting curve based on FSRS',
          actual: 'Actual - Performance based on real review records',
          review: 'Review Points - Memory state at review moments'
        },
        emptyState: {
          title: 'Insufficient Data',
          description: 'At least 2 review records needed to generate memory curve',
          reviewCount: 'Current reviews: {count}'
        },
        insights: {
          title: 'Curve Insights',
          forgetting: {
            title: 'Forgetting Curve',
            description: 'Memory naturally decays over time, higher stability means flatter curve'
          },
          optimalTiming: {
            title: 'Optimal Review Timing',
            description: 'Most effective when retrievability drops to 70-80%'
          },
          stabilityGrowth: {
            title: 'Stability Growth',
            description: 'Successful reviews significantly increase stability and extend intervals'
          },
          lapsesImpact: {
            title: 'Lapses Impact',
            description: 'Lapses reduce stability but benefit long-term memory'
          }
        },
        summary: {
          dataPoints: 'Data Points',
          reviewMarkers: 'Review Markers',
          currentStability: 'Current Stability',
          currentRetrievability: 'Current Retrievability',
          pointsUnit: '',
          daysUnit: 'days'
        }
      },
      apkgImport: {
        title: 'APKG Import',
        selectFile: 'Please select .apkg file',
        invalidFile: 'Please select .apkg file',
        importing: 'Importing...',
        importComplete: 'Import Complete',
        importFailed: 'Import Failed',
        stages: {
          parsing: 'Parsing file',
          media: 'Importing media',
          cards: 'Importing cards',
          finalizing: 'Finalizing'
        }
      },
      fileSelector: {
        title: 'Select Files',
        rootFolder: 'Root',
        selectAll: 'Select All',
        deselectAll: 'Deselect All',
        selected: '{count} files selected',
        confirm: 'Confirm',
        cancel: 'Cancel'
      },
      cardPreview: {
        title: 'Card Preview',
        back: 'Back',
        close: 'Close',
        selectCard: 'Select this card',
        modifyRequirement: 'Modify Generation',
        collapseDialog: 'Collapse',
        prevCard: 'Previous',
        nextCard: 'Next',
        selectAll: 'Select All',
        deselectAll: 'Deselect All',
        selected: 'Selected',
        cardsUnit: 'cards',
        importTo: 'Import to',
        importCards: 'Import {count} Cards',
        importing: 'Importing...',
        generating: 'Generating',
        generatingProgress: 'Generating {current}/{total}'
      },
      aiConfig: {
        title: 'AI Card Generation Settings',
        tabs: {
          cardSettings: 'Card Settings',
          prompts: 'Prompts',
          aiSettings: 'AI Settings'
        },
        generation: {
          cardCount: 'Generation Count',
          difficulty: 'Difficulty Level',
          basic: 'Basic',
          intermediate: 'Intermediate',
          advanced: 'Advanced'
        },
        types: {
          title: 'Type Distribution',
          qa: 'Q&A',
          choice: 'Choice',
          fill: 'Fill-in',
          cloze: 'Cloze'
        }
      },
      batchTemplateChange: {
        title: 'Batch Change Template',
        selectTemplate: 'Select new template',
        confirm: 'Confirm Change',
        cancel: 'Cancel'
      },
      createDeck: {
        titleCreate: 'New Deck',
        titleEdit: 'Edit Deck',
        titleCreateSub: 'New Subdeck',
        parentDeck: 'Parent Deck (Optional)',
        noParent: 'None (Create Root Deck)',
        willCreateAs: 'Will be created as subdeck of "{parent}"',
        name: 'Name',
        namePlaceholder: 'e.g., Computer Science',
        description: 'Description',
        descriptionPlaceholder: 'Optional',
        category: 'Categories (Multi-select)',
        categoryLoading: 'Loading categories...',
        categorySelected: '{count} categories selected',
        categoryDisabled: 'Subdecks cannot have categories, they inherit from parent',
        deckType: 'Deck Type',
        deckTypeMixed: 'Mixed Types',
        deckTypeMixedDesc: 'Can add all types of cards',
        deckTypeChoice: 'Choice Questions Only',
        deckTypeChoiceDesc: 'Can only add choice question cards',
        deckTypeHint: 'This deck can only add choice question cards',
        cancel: 'Cancel',
        create: 'Create',
        save: 'Save',
        close: 'Close',
        initFailed: 'Initialization failed, please retry',
        createFailed: 'Failed to create deck: {error}',
        tagLabel: 'Deck Tag (Single Select)',
        removeTag: 'Remove Tag',
        tagPlaceholder: 'Type a tag and press Enter to add',
        availableTags: 'Available Tags (Click to Select)',
        tagHint: 'Tags are used for deck classification, only one tag can be selected'
      }
    },
    
    //  Commands
    commands: {
      formatAsCloze: {
        name: 'Format as Progressive Cloze',
        noSelection: 'Please select text first',
        success: 'Formatted as progressive cloze, please enter number (e.g., 1, 2, 3)',
        error: 'Format failed, please try again'
      }
    },
    
    //  About
    about: {
      title: 'About Weave',
      product: {
        name: 'Weave - Reading Highlights, Flashcards, and Quiz Practice',
        productName: 'Product Name',
        version: 'Version',
        versionLabel: 'Version',
        algorithm: 'Core Algorithm',
        algorithmValue: 'Incremental Reading (TVP-DS) · Memory Decks (FSRS6) · Quiz Practice (EWMA)',
        platform: 'Platform',
        platformValue: 'Obsidian',
        developer: 'Developer',
        developerValue: 'Rabbit',
        licenseMode: 'License Mode',
        licenseModeValue: 'Completely Free + Premium Features License',
        description: 'An Obsidian-first plugin for reading highlights, flashcard memory, and quiz practice'
      },
      quickLinks: {
        title: 'Quick Links',
        openSource: 'Partially Open Source',
        documentation: 'View Tutorial (Drafting)',
        changelog: 'Changelog',
        support: 'Contact Support'
      },
      acknowledgments: {
        title: 'Special Thanks',
        fsrs: 'FSRS Algorithm',
        fsrsDesc: 'FSRS Algorithm Team',
        obsidian: 'Obsidian',
        obsidianDesc: 'Obsidian Platform Support',
        anki: 'Anki',
        ankiDesc: 'Anki Project Inspiration',
        community: 'SamuelKreatorsz',
        communityDesc: 'Community Contributors'
      },
      license: {
        title: 'License Information',
        status: 'Status',
        statusActive: 'Premium Features Activated',
        statusInactive: 'Premium Features Not Activated',
        type: 'Type',
        manage: 'Manage',
        activation: {
          title: 'License Activation',
          code: 'Activation Code',
          placeholder: 'Enter license activation code',
          activate: 'Activate',
          activating: 'Activating...',
          formTitle: 'License Activation',
          formDesc: 'Enter activation code and email to unlock premium features',
          licensed: 'License Activated',
          activatedAt: 'Activated: ',
          licenseType: 'License Type: ',
          lifetime: 'Lifetime License',
          subscription: 'Subscription License',
          boundEmail: 'Bound Email: ',
          activatedDevices: 'Activated Devices: ',
          codeLabel: 'Activation Code',
          collapseCode: 'Collapse',
          viewCode: 'View activation code',
          copyCode: 'Copy activation code',
          codeCopied: 'Activation code copied to clipboard',
          copyFailed: 'Copy failed, please copy manually',
          deactivate: 'Deactivate',
          confirmDeactivate: 'Are you sure you want to deactivate? You will need to reactivate to use premium features.',
          confirmDeactivateTitle: 'Confirm Deactivation',
          deactivated: 'License deactivated',
          deactivateFailed: 'Failed to deactivate license',
          deactivateError: 'Error occurred while deactivating',
          codeHint: 'Please paste the full activation code',
          validating: 'Validating...',
          formatValid: 'Format valid',
          formatInvalid: 'Invalid format',
          clearInput: 'Clear input',
          clear: 'Clear',
          chars: 'characters',
          lengthInvalid: 'Length does not meet requirements',
          formatIncorrect: 'Format incorrect',
          emailLabel: 'Email Address',
          emailHint: 'This email will be bound to the activation code',
          emailPlaceholder: 'Enter your email',
          emailValid: 'Email format valid',
          emailInvalid: 'Please enter a valid email address',
          confirmEmail: 'Confirm Email',
          confirmEmailHint: 'Please enter email again',
          emailMatch: 'Emails match',
          emailMismatch: 'Emails do not match',
          activateLicense: 'Activate License',
          hideHelp: 'Hide Help',
          showHelp: 'Show Help',
          helpFormatTitle: 'Activation Code Format',
          helpInputTitle: 'Input Tips',
          helpTroubleshootTitle: 'Troubleshooting',
          helpContactTitle: 'Contact Support',
          helpContactMsg: 'For assistance, please contact: ',
          errorTitle: 'Activation Failed',
          remainingAttempts: 'Remaining attempts: {count}',
          successTitle: 'Activation Successful',
          successMsg: 'License activated successfully, premium features are now enabled',
          deviceReplaced: 'Device limit reached, the least recently used device has been automatically removed',
          tooManyAttempts: 'Too many activation attempts',
          activationFailed: 'Activation failed',
          unknownError: 'Unknown error occurred during activation'
        },
        statusCard: {
          activated: 'License Activated',
          notActivated: 'License Not Activated',
          unknown: 'Unknown',
          lifetimeBuyout: 'Lifetime License',
          subscriptionLicense: 'Subscription License',
          license: 'License',
          licenseType: 'License Type',
          lifetimeValid: 'Lifetime Valid',
          activatedAt: 'Activated At',
          expiresAt: 'Expires At',
          productVersion: 'Product Version',
          expired: 'Expired',
          daysUntilExpiry: 'Expires in {days} days',
          longTermValid: 'Long-term Valid',
          verifyLicense: 'Verify License',
          resetLicense: 'Reset License',
          inactiveMsg: 'Currently only free features are available. Activate a license to unlock all premium features.'
        }
      },
      contact: {
        title: 'Contact',
        github: 'GitHub Repository',
        email: 'Email',
        support: 'Technical Support',
        website: 'Official Website'
      }
    },
    
    //  Settings Constants
    settingsConstants: {
      linkPath: {
        short: 'Shortest Path (Filename)',
        relative: 'Relative Path',
        absolute: 'Absolute Path'
      },
      modalSize: {
        small: 'Small (600\u00d7400)',
        medium: 'Medium (700\u00d7500)',
        large: 'Large (800\u00d7600)',
        extraLarge: 'Extra Large (1000\u00d7700)',
        custom: 'Custom'
      },
      productInfo: {
        name: 'Weave - Reading Highlights, Flashcards & Quiz Practice',
        algorithm: 'Incremental Reading (TVP-DS) \u00b7 Memory Decks (FSRS6) \u00b7 Quiz Practice (EWMA)',
        licenseModel: 'Free Plugin + Premium Features License'
      },
      contactInfo: {
        supportSubject: 'Weave Plugin License Purchase Inquiry'
      },
      features: {
        free: [
          'Basic Spaced Repetition Learning',
          'FSRS6 Smart Algorithm',
          'Card Creation & Editing',
          'Learning Progress Tracking',
          'Local Data Storage',
          'Basic Statistics & Analytics'
        ],
        premium: [
          'Advanced Learning Modes',
          'Detailed Data Analytics',
          'AI Batch Card Creation (In Development)',
          'Exam Mode (In Development)'
        ]
      },
      devStatus: {
        stable: 'Stable',
        beta: 'Beta',
        alpha: 'Alpha',
        development: 'In Development',
        planned: 'Planned'
      },
      aiProviderLabels: {
        zhipu: 'Zhipu AI',
        siliconflow: 'SiliconFlow'
      },
      aiProviderDesc: {
        openai: 'OpenAI Official API',
        gemini: 'Google AI, free tier available',
        anthropic: 'Claude series, excellent at code and long text',
        deepseek: 'OpenAI-compatible, high cost-performance',
        zhipu: 'Chinese AI model, free tier, direct access in China',
        siliconflow: 'Model aggregation platform, multiple open-source models',
        xai: 'Grok series, OpenAI-compatible API'
      },
      aiKeyPlaceholder: {
        zhipu: 'Enter API Key'
      },
      acknowledgments: {
        fsrs: { name: 'FSRS Algorithm', description: 'Scientific spaced repetition algorithm' },
        obsidian: { name: 'Obsidian', description: 'Excellent knowledge management platform' },
        anki: { name: 'Anki', description: 'Pioneer of spaced repetition learning' },
        samdagreatwzzz: { name: 'SamdaGreatzzz', description: 'AI card creation design inspiration' }
      },
      promptTemplates: {
        standardQa: { name: 'Standard Q&A Generation', description: 'For general learning materials, generates standard Q&A cards with multiple question types', prompt: 'Generate {count} Q&A cards based on the following content, difficulty: {difficulty}. Questions should be concise and clear, answers complete and accurate.' },
        conceptExplain: { name: 'Concept Explanation', description: 'Focuses on concept understanding, generates definition and explanation cards', prompt: 'Extract key concepts and generate explanation cards, including definitions, features, and use cases.' },
        deepUnderstanding: { name: 'Deep Understanding', description: 'Generates higher-order thinking cards, emphasizing comprehension and application', prompt: 'Generate cards requiring deep thinking, focusing on understanding, analysis, and application. Avoid simple memorization questions.' },
        clozeFill: { name: 'Cloze Fill', description: 'Focuses on generating cloze cards, ideal for key terms and concepts', prompt: 'Generate cloze cards using {{c1::}} syntax to mark keywords. 1-3 cloze points per card.' }
      }
    },
    //  Settings Utility Functions
    settingsUtils: {
      operationFailed: 'Operation failed',
      licenseStatus: {
        inactive: 'Not Activated',
        expired: 'Expired',
        expiringIn: 'Expires in {days} days',
        active: 'Activated'
      },
      validation: {
        codeEmpty: 'Activation code cannot be empty',
        codeTooShort: 'Activation code too short, at least {min} characters required',
        codeInvalidChars: 'Activation code contains invalid characters, only letters, numbers, hyphens and dots allowed',
        codeIncomplete: 'Activation code may be incomplete, please ensure you copied the full code'
      },
      errors: {
        invalidFormat: 'Invalid activation code format',
        invalidFormatSolution: 'Please ensure you copied the full activation code including all characters and dot separators',
        codeExpired: 'Activation code has expired',
        codeExpiredSolution: 'Please contact support for a new activation code',
        deviceLimit: 'Device binding limit reached',
        deviceLimitSolution: 'Please unbind from other devices first, or contact support to increase the device limit',
        networkFailed: 'Cannot connect to activation server',
        networkFailedSolution: 'Please check your network connection, or try again later',
        serverError: 'Activation server temporarily unavailable',
        serverErrorSolution: 'Please try again later, contact support if the issue persists'
      }
    },
    //  License Activation
    license: {
      boundEmail: 'Bound Email',
      activatedDevices: 'Activated Devices',
      activationPrompt: 'Unlock more powerful features after activation',
      getActivationCode: 'Get Activation Code',
      activatePremium: 'Activate Premium Features'
    }
  }
};

// ============================================================================
// 国际化配置
// ============================================================================

const defaultConfig: I18nConfig = {
  defaultLanguage: 'zh-CN',
  fallbackLanguage: 'zh-CN',
  supportedLanguages: ['zh-CN', 'en-US']
};

// ============================================================================
// 自动检测Obsidian语言设置
// ============================================================================

/**
 * 从Obsidian的localStorage获取当前语言设置
 * Obsidian语言代码: en, zh, zh-TW, ru, ko, it, id, ro, pt-BR, cz, de, es, fr, no, pl, pt, ja, da, uk, sq, tr, hi, se, nl, ar, th, fa, vi, he, ms, ca, am
 */
function detectObsidianLanguage(): SupportedLanguage {
  try {
    // 方法1: 使用moment.locale() - Obsidian使用moment.js管理语言
    // @ts-ignore - moment是Obsidian全局变量
    const momentLocale = window.moment?.locale?.();
    
    if (momentLocale) {
      // 中文locale: zh-cn, zh-tw
      if (momentLocale.startsWith('zh')) {
        return 'zh-CN';
      }
      // 其他语言使用英文
      return 'en-US';
    }
    
    // 方法2: localStorage (备用)
    const obsidianLang = vaultStorage.getItem('language');
    
    if (obsidianLang) {
      if (obsidianLang === 'zh' || obsidianLang === 'zh-TW') {
        return 'zh-CN';
      }
      return 'en-US';
    }
    
    // 方法3: 浏览器语言 (最后备用)
    const browserLang = window?.navigator?.language;
    if (browserLang && browserLang.startsWith('zh')) {
      return 'zh-CN';
    }
    
    return 'en-US';
  } catch (e) {
    return defaultConfig.defaultLanguage;
  }
}

// ============================================================================
// 状态管理
// ============================================================================

export const currentLanguage = writable<SupportedLanguage>(defaultConfig.defaultLanguage);

/**
 * 初始化国际化系统 - 检测Obsidian语言并设置
 * 应在插件onload时调用
 */
export function initI18n(): void {
  const detectedLang = detectObsidianLanguage();
  currentLanguage.set(detectedLang);
}
export const i18nConfig = writable<I18nConfig>(defaultConfig);

// ============================================================================
// 国际化服务类
// ============================================================================

export class I18nService {
  private static instance: I18nService;
  private currentLang: SupportedLanguage = defaultConfig.defaultLanguage;
  private config: I18nConfig = defaultConfig;

  private constructor() {
    // 订阅语言变化
    currentLanguage.subscribe(_lang => {
      this.currentLang = _lang;
    });

    // 订阅配置变化
    i18nConfig.subscribe(_config => {
      this.config = _config;
    });
  }

  static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
    }
    return I18nService.instance;
  }

  /**
   * 获取翻译文本
   */
  t(key: string, params?: Record<string, string | number>): string {
    const translation = this.getTranslation(key, this.currentLang);

    if (!translation) {
      // 尝试回退语言
      const fallbackTranslation = this.getTranslation(key, this.config.fallbackLanguage);
      if (fallbackTranslation) {
        return this.interpolate(fallbackTranslation, params);
      }

      // 返回键名作为最后的回退
      logger.warn(`Translation not found for key: ${key}`);
      return key;
    }

    return this.interpolate(translation, params);
  }

  /**
   * 获取指定语言的翻译
   */
  private getTranslation(key: string, language: SupportedLanguage): string | null {
    const keys = key.split('.');
    let current: any = translations[language];

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }

    return typeof current === 'string' ? current : null;
  }

  /**
   * 插值处理
   */
  private interpolate(text: string, params?: Record<string, string | number>): string {
    if (!params) return text;

    return text.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key]?.toString() || match;
    });
  }

  /**
   * 设置当前语言
   */
  setLanguage(language: SupportedLanguage): void {
    if (this.config.supportedLanguages.includes(language)) {
      currentLanguage.set(language);
    } else {
      logger.warn(`Unsupported language: ${language}`);
    }
  }

  /**
   * 获取当前语言
   */
  getCurrentLanguage(): SupportedLanguage {
    return this.currentLang;
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return this.config.supportedLanguages;
  }

  /**
   * 获取数组类型的翻译
   */
  tArray(key: string): string[] {
    const result = this.getTranslationRaw(key, this.currentLang);
    if (Array.isArray(result)) return result;

    const fallback = this.getTranslationRaw(key, this.config.fallbackLanguage);
    if (Array.isArray(fallback)) return fallback;

    return [];
  }

  /**
   * 获取原始翻译值（字符串或数组）
   */
  private getTranslationRaw(key: string, language: SupportedLanguage): unknown {
    const keys = key.split('.');
    let current: any = translations[language];

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * 检查是否支持指定语言
   */
  isLanguageSupported(language: string): language is SupportedLanguage {
    return this.config.supportedLanguages.includes(language as SupportedLanguage);
  }
}

// ============================================================================
// 导出实例和工具函数
// ============================================================================

export const i18n = I18nService.getInstance();

// 便捷的翻译函数
export const t = (key: string, params?: Record<string, string | number>) => i18n.t(key, params);

// Svelte store 用于响应式翻译
export const tr = derived(
  currentLanguage,
  (_$currentLanguage) => (key: string, params?: Record<string, string | number>) => i18n.t(key, params)
);

export const trArray = derived(
  currentLanguage,
  (_$currentLanguage) => (key: string) => i18n.tArray(key)
);
