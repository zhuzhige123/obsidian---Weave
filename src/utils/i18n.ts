import { logger } from '../utils/logger';
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
  [key: string]: string | TranslationKey;
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
        pluginSystem: '插件',
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
          title: '批量解析分隔符',
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
    
    //  导航栏
    navbar: {
      openSettings: '打开设置',
      settings: '设置',
      // 🆕 折叠功能
      collapse: '收起导航栏',
      expand: '展开导航栏',
      collapseHint: '将鼠标移到此处展开导航栏'
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
        modified: '修改时间'
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
        error: '导入失败: {error}'
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
    
    //  插件系统
    pluginSystem: {
      title: '插件管理',
      description: '管理已安装的 Weave 插件。将插件放入 weave/plugins/ 目录即可安装。',
      loading: '正在加载插件列表...',
      refresh: '刷新',
      openFolder: '打开插件目录',
      reload: '重新加载',
      state: {
        enabled: '已启用',
        disabled: '已禁用',
        error: '错误',
        loading: '加载中'
      },
      empty: {
        title: '暂无已安装插件',
        hint: '将插件文件夹放入 weave/plugins/ 目录后重新加载即可。'
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
        configOptions: '配置选项'
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
        }
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
        }
      },
      autoSync: {
        title: '自动同步配置',
        enable: '启用自动同步',
        enableDesc: '在文档变化时自动同步到Anki'
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
      sectionSync: {
        title: '板块同步配置',
        enable: '启用板块同步',
        enableDesc: '同步板块内容到Anki'
      }
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
        moreActions: '更多操作'
      },
      card: {
        ariaLabel: '牌组: {name}',
        new: '未',
        learning: '学',
        review: '复',
        newFull: '未学',
        learningFull: '学习',
        reviewFull: '复习',
        moreActions: '更多操作'
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
        childDeck: '子卡片牌组'
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
      graphLinkInitFailed: '图谱联动初始化失败'
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
        createFailed: '创建牌组失败: {error}'
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
        developerValue: 'Robbit（zhuzhige）',
        licenseMode: '许可模式',
        licenseModeValue: '完全免费 + 高级功能许可证',
        description: '完全服务于obsidian的阅读摘录，卡片记忆，考试测试的插件'
      },
      quickLinks: {
        title: '快捷链接',
        openSource: '部分开源',
        documentation: '查看文档',
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
          activating: '激活中...'
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
    
    //  许可证激活
    license: {
      boundEmail: '绑定邮箱',
      activatedDevices: '已激活设备',
      activationPrompt: '激活后解锁更多强大功能',
      getActivationCode: '获取激活码',
      activatePremium: '激活高级功能'
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
        pluginSystem: 'Plugins',
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
          title: 'Batch Parsing Delimiters',
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
        cardsStudied: 'Cards Studied',
        timeSpent: 'Time Spent',
        accuracy: 'Accuracy'
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
    
    //  Navigation Bar
    navbar: {
      openSettings: 'Open Settings',
      settings: 'Settings',
      // 🆕 Collapse Feature
      collapse: 'Collapse Navbar',
      expand: 'Expand Navbar',
      collapseHint: 'Move mouse here to expand navbar'
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
        modified: 'Modified Time'
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
        error: 'Import failed: {error}'
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
    
    //  Plugin System
    pluginSystem: {
      title: 'Plugin Manager',
      description: 'Manage installed Weave plugins. Place plugins in weave/plugins/ to install.',
      loading: 'Loading plugins...',
      refresh: 'Refresh',
      openFolder: 'Open plugins folder',
      reload: 'Reload',
      state: {
        enabled: 'Enabled',
        disabled: 'Disabled',
        error: 'Error',
        loading: 'Loading'
      },
      empty: {
        title: 'No plugins installed',
        hint: 'Place plugin folders into weave/plugins/ and reload.'
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
        configOptions: 'Configuration Options'
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
        }
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
        }
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
        enableDesc: 'Automatically sync to Anki on document changes'
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
      sectionSync: {
        title: 'Section Sync Configuration',
        enable: 'Enable Section Sync',
        enableDesc: 'Synchronize section content to Anki'
      }
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
        moreActions: 'More Actions'
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
        childDeck: 'Child Card Deck'
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
      graphLinkInitFailed: 'Failed to initialize graph link'
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
        createFailed: 'Failed to create deck: {error}'
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
        developerValue: 'Robbit (zhuzhige)',
        licenseMode: 'License Mode',
        licenseModeValue: 'Completely Free + Premium Features License',
        description: 'An Obsidian-first plugin for reading highlights, flashcard memory, and quiz practice'
      },
      quickLinks: {
        title: 'Quick Links',
        openSource: 'Partially Open Source',
        documentation: 'View Documentation',
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
          activating: 'Activating...'
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
    const obsidianLang = window.localStorage.getItem('language');
    
    if (obsidianLang) {
      if (obsidianLang === 'zh' || obsidianLang === 'zh-TW') {
        return 'zh-CN';
      }
      return 'en-US';
    }
    
    // 方法3: 浏览器语言 (最后备用)
    const browserLang = navigator.language || (navigator as any).userLanguage;
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
