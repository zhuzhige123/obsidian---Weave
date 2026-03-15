<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { Platform, Notice } from "obsidian";
  import type { WeavePlugin } from "../../main";
  import type { TestSession, TestQuestionRecord, TestMode } from "../../types/question-bank-types";
  import type { Card } from "../../data/types";
  import { TestSessionManager, TestScoringEngine } from "../../services/question-bank";
  import type { EmbeddableEditorManager } from "../../services/editor/EmbeddableEditorManager";
  import ObsidianIcon from "../ui/ObsidianIcon.svelte";
  import EnhancedIcon from "../ui/EnhancedIcon.svelte";
  import { showObsidianConfirm } from "../../utils/obsidian-confirm";
  import QuestionBankHeader from "./QuestionBankHeader.svelte";
  import QuestionBankStatsCards from "./QuestionBankStatsCards.svelte";
  import QuestionBankActionSection from "./QuestionBankActionSection.svelte";
  import QuestionBankVerticalToolbar from "./QuestionBankVerticalToolbar.svelte";
  import QuestionNavigator from "./QuestionNavigator.svelte";
  import CardEditorContainer from "../study/CardEditorContainer.svelte";
  import CardDebugModal from "../modals/CardDebugModal.svelte";
  import QuestionBankCardDetailModal from "../modals/QuestionBankCardDetailModal.svelte";
  import { logger } from "../../utils/logger";
  import { extractBodyContent } from "../../utils/yaml-utils";
  
  // 选择题渲染支持
  import ChoiceOptionRenderer from "../atoms/ChoiceOptionRenderer.svelte";
  import ObsidianRenderer from "../atoms/ObsidianRenderer.svelte";
  import type { ChoiceQuestion } from "../../parsing/choice-question-parser";
  import { parseCardContent } from "../../parsing/card-content-parser";
  import CardContentView from "../content/CardContentView.svelte";
  
  // 重要程度贴纸
  import ImportanceIndicator from "./ImportanceIndicator.svelte";
  
  //  移动端组件
  import MobileQuestionStatsBar from "./MobileQuestionStatsBar.svelte";
  import { QuestionBankMenuBuilder, type QuestionBankMenuConfig, type QuestionBankMenuCallbacks } from "../../services/menu/QuestionBankMenuBuilder";

  //  移动端视图实例类型
  import type { QuestionBankView } from "../../views/QuestionBankView";

  interface Props {
    bankId: string;
    bankName?: string;
    plugin: WeavePlugin;
    questions: Card[];
    mode?: TestMode;
    config?: import("../../types/question-bank-types").QuestionBankModeConfig;
    viewInstance?: QuestionBankView; //  视图实例用于移动端回调
    onComplete?: (session: TestSession) => void;
    onExit?: () => void;
  }

  const editorSessionId = `weave-question-bank-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let { bankId, bankName = "题库测试", plugin, questions, mode = 'exam', config, viewInstance, onComplete, onExit }: Props = $props();

  // 会话管理
  let sessionManager: TestSessionManager | null = $state(null);  //  修复：使用$state声明
  let currentSession = $state<TestSession | null>(null);
  let currentQuestion = $state<TestQuestionRecord | null>(null);

  // UI状态
  let isLoading = $state(false);
  let userAnswer = $state<string | string[] | null>(null);
  let hasSubmitted = $state(false);
  let statsCollapsed = $state(false);
  let showSidebar = $state(true);
  let showNavigator = $state(true);  // 题目导航栏显示状态

  // 撤销功能
  let undoCount = $state(0); // 已使用的撤销次数
  const maxUndoCount = $derived(Math.ceil(questions.length * 0.2)); // 最大撤销次数（20%）
  const canUndo = $derived(undoCount < maxUndoCount && hasSubmitted); // 是否可以撤销

  // 编辑器状态
  let showEditModal = $state(false);
  let editorPoolManager: EmbeddableEditorManager | null = $state(null);
  let tempFileUnavailable = $state(false);
  let isClozeMode = $state(false);

  // 删除确认弹窗状态
  let showDeleteConfirmModal = $state(false);
  let deleteConfirmCardId = $state('');
  let enableDirectDelete = $state(plugin.settings.enableDirectDelete ?? false);

  // 重要程度功能状态
  let showPriorityModal = $state(false);
  let selectedPriority = $state(2);

  // 题目学习顺序设置
  let questionOrder = $state<'sequential' | 'random'>('sequential');
  
  // 题目导航列数模式（持久化）
  let navColumnMode = $state<1 | 3>(3);

  // 侧边栏紧凑模式
  let compactMode = $state(false);
  let compactModeSetting = $state<'auto' | 'fixed'>('auto');

  let sidebarContentEl: HTMLDivElement | null = $state(null);
  let sidebarResizeObserver: ResizeObserver | null = $state(null);

  //  移动端状态
  const isMobile = Platform.isMobile;
  let showMobileStatsBar = $state(true); // 答题情况信息栏是否展开
  let showMobileMenu = $state(false); // 移动端多功能菜单

  let isKeyboardVisible = $state(false);
  let mobileViewportHeight = $state<number | null>(null);
  let mobileViewportCleanup: (() => void) | null = null;

  const OBSIDIAN_MOBILE_HEADER_HEIGHT = 44;

  // --- 题目数据结构调试窗口状态 ---
  let showCardDebug = $state(false);

  // --- 卡片详情模态窗状态 ---
  let showDetailModal = $state(false);

  // 计时器
  let elapsedSeconds = $state(0);
  let timerInterval: number | null = null;

  // 考试倒计时（FlipClock）
  let examDuration = $state(60 * 60 * 1000);  // 默认60分钟
  let examStartTime = $state(0);
  let remainingTime = $state(0);
  let isPaused = $state(false);
  let isTimeWarning = $derived(remainingTime > 0 && remainingTime < 5 * 60 * 1000);  // 最后5分钟警告

  // ===== 工具函数 =====
  
  /**
   * 统一错误处理函数
   * @param error 错误对象
   * @param operation 操作名称（用于日志）
   * @param userMessage 显示给用户的消息（可选，默认为"${operation}失败"）
   */
  function handleOperationError(error: unknown, operation: string, userMessage?: string) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`[QuestionBankStudyInterface] ${operation} failed:`, error);
    new Notice(userMessage || `${operation}失败: ${errorMessage}`);
  }

  // 自动解析当前题目的选择题数据（支持Obsidian渲染）
  // 使用 $derived 而非 $effect 避免无限循环
  let choiceQuestionDerived = $derived.by(() => {
    if (currentQuestion?.question.content) {
      try {
        const parsed = parseCardContent(currentQuestion.question.content);
        const choice: ChoiceQuestion | null = parsed.kind === 'choice' ? parsed.choice : null;
        //  调试日志：记录解析结果
        if (choice) {
          logger.debug('[QuestionBankStudyInterface] 选择题解析成功:', {
            hasExplanation: !!choice.explanation,
            explanationLength: choice.explanation?.length || 0,
            explanationPreview: choice.explanation?.substring(0, 50) || '(无解析)'
          });
        }
        return choice;
      } catch (error) {
        // 不是选择题格式，返回null
        logger.debug('[QuestionBankStudyInterface] 选择题解析失败:', error);
        return null;
      }
    }
    return null;
  });

  // 初始化会话
  async function initSession() {
    isLoading = true;
    try {
      if (!plugin.questionBankStorage) {
        throw new Error("QuestionBankStorage not initialized");
      }

      sessionManager = new TestSessionManager(plugin.questionBankStorage, plugin.questionBankService);

      const persisted = await plugin.questionBankStorage.loadInProgressSession(bankId);
      if (persisted && persisted.status === 'in_progress') {
        const confirmed = await showObsidianConfirm(
          plugin.app,
          '检测到未完成的考试进度，是否恢复？',
          { title: '恢复进度', confirmText: '恢复', cancelText: '重新开始' }
        );

        if (confirmed) {
          currentSession = await sessionManager.restoreSession(bankId);
          currentQuestion = sessionManager.getCurrentQuestion();
          if (currentQuestion) {
            userAnswer = currentQuestion.userAnswer || null;
            hasSubmitted = currentQuestion.isCorrect !== null && currentQuestion.isCorrect !== undefined;
          }
          startTimer();
          initExamTimer();
          return;
        } else {
          await plugin.questionBankStorage.clearInProgressSession(bankId);
        }
      }
      
      currentSession = await sessionManager.startSession(
        {
          bankId,
          mode: mode,
          shuffleQuestions: config?.shuffleQuestions ?? false,
          shuffleOptions: config?.shuffleOptions ?? false,
          questionCount: config?.questionCount,
          timeLimit: config?.timeLimit
        },
        questions
      );

      currentQuestion = sessionManager.getCurrentQuestion();
      startTimer();
      initExamTimer();  // 初始化考试倒计时
    } catch (error) {
      handleOperationError(error, '初始化测试', '启动测试失败');
    } finally {
      isLoading = false;
    }
  }

  // 提交答案
  async function handleSubmitAnswer() {
    if (!sessionManager || !currentQuestion || hasSubmitted || !userAnswer) {
      return;
    }

    try {
      const result = await sessionManager.submitAnswer({
        questionId: currentQuestion.questionId,
        answer: userAnswer,
        timeSpent: elapsedSeconds
      });

      hasSubmitted = true;

      //  修复：同步更新currentQuestion的isCorrect状态
      // 确保UI能正确显示答题结果和解析内容
      if (currentQuestion) {
        currentQuestion.isCorrect = result.isCorrect;
        currentQuestion.userAnswer = userAnswer;
        currentQuestion.submittedAt = new Date().toISOString();
        // 触发响应式更新
        currentQuestion = { ...currentQuestion };
      }

      // 更新当前会话
      currentSession = sessionManager.getCurrentSession();
      
      //  调试日志：记录提交答案后的解析状态
      logger.debug('[QuestionBankStudyInterface] 提交答案后:', {
        hasSubmitted,
        hasExplanation: !!choiceQuestionDerived?.explanation,
        explanationLength: choiceQuestionDerived?.explanation?.length || 0,
        isCorrect: currentQuestion?.isCorrect,
        explanationContent: choiceQuestionDerived?.explanation
      });
    } catch (error) {
      handleOperationError(error, '提交答案');
    }
  }

  // 下一题
  async function handleNextQuestion() {
    if (!sessionManager) return;

    const hasNext = await sessionManager.moveToNextQuestion();
    
    if (hasNext) {
      //  修复：使用刷新方法从数据库加载最新数据
      currentQuestion = await sessionManager.getCurrentQuestionWithRefresh();
      userAnswer = null;
      hasSubmitted = false;
      elapsedSeconds = 0;
      currentSession = sessionManager.getCurrentSession();
    } else {
      // 已经是最后一题，完成测试
      await handleCompleteTest();
    }
  }

  // 上一题（仅查看）
  async function handlePreviousQuestion() {
    if (!sessionManager) return;

    const hasPrev = await sessionManager.moveToPreviousQuestion();
    
    if (hasPrev) {
      //  修复：使用刷新方法从数据库加载最新数据
      currentQuestion = await sessionManager.getCurrentQuestionWithRefresh();
      userAnswer = currentQuestion?.userAnswer || null;
      //  修复：统一判断逻辑，确保已作答的题目正确显示状态
      hasSubmitted = currentQuestion?.isCorrect !== null && currentQuestion?.isCorrect !== undefined;
      currentSession = sessionManager.getCurrentSession();
      
      //  调试日志：记录切换后的状态
      logger.debug('[QuestionBankStudyInterface] 切换到上一题:', {
        hasSubmitted,
        isCorrect: currentQuestion?.isCorrect,
        userAnswer: currentQuestion?.userAnswer
      });
    }
  }

  // 完成测试
  async function handleCompleteTest() {
    if (!sessionManager) return;

    try {
      const completedSession = await sessionManager.completeSession();
      stopTimer();
      
      if (onComplete) {
        onComplete(completedSession);
      }
    } catch (error) {
      handleOperationError(error, '完成测试');
    }
  }

  // 撤销答案
  async function handleUndoAnswer() {
    if (!canUndo || !currentQuestion || !sessionManager) {
      return;
    }

    // 增加撤销次数
    undoCount++;

    // 清除后端记录（允许重新提交）
    const currentIndex = currentSession?.currentQuestionIndex ?? 0;
    const questionRecord = currentSession?.questions[currentIndex];
    if (questionRecord && currentSession) {
      // 保存当前的正确性状态（用于更新统计）
      const wasCorrect = questionRecord.isCorrect;
      
      // 重置后端题目记录
      questionRecord.userAnswer = null;
      questionRecord.isCorrect = null;
      questionRecord.timeSpent = 0;
      questionRecord.submittedAt = null;
      
      // 更新会话统计（撤销之前的结果）
      if (wasCorrect === true) {
        currentSession.correctCount = Math.max(0, currentSession.correctCount - 1);
      } else if (wasCorrect === false) {
        currentSession.wrongCount = Math.max(0, currentSession.wrongCount - 1);
      }
      
      // 减少已完成题数
      currentSession.completedQuestions = Math.max(0, currentSession.completedQuestions - 1);
      
      // 同步 incorrectCount
      currentSession.incorrectCount = currentSession.wrongCount;
      
      // 重新计算分数和正确率
      const answeredCount = currentSession.correctCount + currentSession.wrongCount;
      currentSession.score = answeredCount > 0 
        ? (currentSession.correctCount / answeredCount) * 100 
        : 0;
      currentSession.accuracy = answeredCount > 0
        ? currentSession.correctCount / answeredCount
        : 0;
    }

    // 重置前端状态
    userAnswer = null;
    hasSubmitted = false;
  }

  // 收藏功能
  async function handleToggleFavorite() {
    if (!currentQuestion) return;

    const favoriteTag = '#收藏';
    const tags = currentQuestion.question.tags || [];
    const isFavorited = tags.includes(favoriteTag);

    if (isFavorited) {
      currentQuestion.question.tags = tags.filter(tag => tag !== favoriteTag);
      new Notice('已取消收藏');
    } else {
      currentQuestion.question.tags = [...tags, favoriteTag];
      new Notice('已收藏');
    }

    // 保存到数据库
    try {
      await plugin.dataStorage.saveCard(currentQuestion.question);
      // 触发界面刷新
      currentQuestion = { ...currentQuestion };
    } catch (error) {
      handleOperationError(error, '保存收藏状态', '保存失败');
    }
  }

  // 编辑功能切换
  async function handleToggleEdit() {
    if (!currentQuestion) {
      logger.warn('[QuestionBankStudyInterface] No current question for editing');
      return;
    }

    if (!showEditModal) {
      await enterEditMode();
    } else {
      await exitEditMode();
    }
  }

  // 进入编辑模式
  async function enterEditMode() {
    tempFileUnavailable = false;
    showEditModal = true;
    await tick();
  }

  // 退出编辑模式（保存并关闭）
  async function exitEditMode() {
    if (!editorPoolManager) {
      logger.error('[QuestionBankStudyInterface] Cannot save: editorPoolManager not available');
      showEditModal = false;
      return;
    }

    try {
      const result = await saveCurrentCard();
      
      if (result.success && result.updatedCard) {
        new Notice('卡片已保存');
        await handleEditorComplete(result.updatedCard);
      } else {
        handleSaveFailure(result.error);
      }
    } catch (error) {
      handleSaveError(error);
    }
  }

  // 保存当前编辑的卡片
  async function saveCurrentCard() {
    if (!editorPoolManager || !currentQuestion) {
      throw new Error('Editor or question not available');
    }

    const sessionCardId = editorSessionId;
    const actualCardId = currentQuestion.question.uuid;
    
    return await editorPoolManager.finishEditing(sessionCardId, true, {
      isStudySession: true,
      targetCardId: actualCardId
    });
  }

  // 处理保存失败
  function handleSaveFailure(error?: string) {
    handleOperationError(error || '未知错误', '保存卡片（点击预览）', '保存失败: ' + (error || '未知错误'));
    // 保持编辑模式，用户可以继续编辑或重试
  }

  // 处理保存异常
  function handleSaveError(error: unknown) {
    handleOperationError(error, '保存卡片（点击预览）', '保存失败');
    // 保持编辑模式
  }

  // 编辑器完成回调
  async function handleEditorComplete(updatedCard: Card) {
    // Notice提示由调用者显示，避免重复
    
    //  修复：四层数据同步（修正时序问题）
    
    try {
      // 0. 【关键修复】先保存到数据库
      const saveResult = await plugin.dataStorage.saveCard(updatedCard);
      if (!saveResult.success) {
        throw new Error(saveResult.error || '保存失败');
      }
      logger.debug('[QuestionBankStudyInterface] 卡片已保存到数据库:', updatedCard.uuid);
      
      // 1. 同步到会话层（最重要！确保切换题目后数据不丢失）
      if (sessionManager && currentSession) {
        const questionIndex = currentSession.questions.findIndex(
          q => q.questionId === updatedCard.uuid
        );
        if (questionIndex !== -1) {
          // 直接修改会话中的question对象
          currentSession.questions[questionIndex].question = updatedCard;
        }
      }
      
      // 2. 同步到全局questions数组
      const globalIndex = questions.findIndex(q => q.uuid === updatedCard.uuid);
      if (globalIndex !== -1) {
        questions[globalIndex] = updatedCard;
        questions = [...questions]; // 触发响应式更新
      }
      
      // 2.5 【关键修复】更新 QuestionBankService 的内存缓存
      // 否则 getCurrentQuestionWithRefresh 会从旧缓存加载数据
      if (plugin.questionBankService) {
        try {
          // updateQuestion 需要部分更新，传递主要字段
          await plugin.questionBankService.updateQuestion(updatedCard.uuid, {
            content: updatedCard.content,
            modified: updatedCard.modified,
            metadata: updatedCard.metadata,
            tags: updatedCard.tags,
            priority: updatedCard.priority,
            stats: updatedCard.stats
          });
          logger.debug('[QuestionBankStudyInterface] QuestionBankService 缓存已更新');
        } catch (error) {
          logger.warn('[QuestionBankStudyInterface] 更新 QuestionBankService 缓存失败:', error);
          // 不阻断流程，继续执行
        }
      }
      
      // 3. 更新界面层（currentQuestion）
      //  修复：直接创建新对象，不要重新获取（避免时序问题）
      if (currentQuestion) {
        // 创建新的 currentQuestion 对象，确保触发响应式
        currentQuestion = {
          ...currentQuestion,
          question: updatedCard  // 使用最新的卡片数据
        };
      }
      
    } catch (error) {
      logger.error('[QuestionBankStudyInterface] 保存卡片到数据库失败:', error);
      new Notice('保存失败: ' + (error instanceof Error ? error.message : '未知错误'));
      // 发生错误时不退出编辑模式，让用户可以重试
      return;
    }
    
    // 退出编辑模式
    showEditModal = false;
    tempFileUnavailable = false;
    isClozeMode = false;
  }

  // 编辑器取消回调
  function handleEditorCancel() {
    showEditModal = false;
    tempFileUnavailable = false;
    isClozeMode = false;
  }

  // 挖空预览切换回调
  function handleToggleCloze() {
    isClozeMode = !isClozeMode;
  }

  // 删除功能
  async function handleDeleteCard(skipConfirm = false) {
    if (!currentQuestion) return;

    // 根据直接删除设置决定是否跳过确认弹窗
    if (!skipConfirm && !enableDirectDelete) {
      const cardContent = currentQuestion.question.content.slice(0, 30) || `ID: ${currentQuestion.question.uuid}`;
      showDeleteConfirmModal = true;
      deleteConfirmCardId = cardContent;
      return;
    }

    try {
      const deletedCardId = currentQuestion.question.uuid;
      
      // 使用题库专用删除方法（更新Service缓存）
      if (!plugin.questionBankService) {
        new Notice('题库服务未初始化');
        return;
      }
      
      await plugin.questionBankService.deleteQuestion(bankId, deletedCardId);

      // 如果正在编辑模式，退出编辑模式
      if (showEditModal) {
        showEditModal = false;
        tempFileUnavailable = false;
        isClozeMode = false;
      }

      // 更新会话中的题目列表
      if (sessionManager && currentQuestion) {
        // 从questions数组中移除
        questions = questions.filter(q => q.uuid !== deletedCardId);
        
        // 如果没有题目了，完成测试
        if (questions.length === 0) {
          new Notice('已删除所有题目，测试结束');
          await handleCompleteTest();
          return;
        }

        // 移动到下一题
        await handleNextQuestion();
        
        new Notice('卡片已删除');
      }

    } catch (e) {
      handleOperationError(e, '删除卡片');
    }
  }

  // 确认删除
  async function confirmDeleteCard() {
    showDeleteConfirmModal = false;
    await handleDeleteCard(true);
  }

  // 取消删除
  function cancelDeleteCard() {
    showDeleteConfirmModal = false;
    deleteConfirmCardId = '';
  }

  // 重要程度功能
  function handleChangePriority() {
    if (!currentQuestion) return;
    selectedPriority = currentQuestion.question.priority || 2;
    showPriorityModal = true;
  }

  async function confirmChangePriority() {
    if (!currentQuestion) return;

    try {
      // 更新卡片的重要程度
      const updatedCard = {
        ...currentQuestion.question,
        priority: selectedPriority,
        modified: new Date().toISOString()
      };

      // 保存卡片
      const result = await plugin.dataStorage.saveCard(updatedCard);
      if (result.success) {
        // 更新当前题目
        currentQuestion.question.priority = selectedPriority;
        currentQuestion = { ...currentQuestion };

        const priorityText = ['', '低', '中', '高', '极高'][selectedPriority] || '中';
        new Notice(`重要程度已设置为：${priorityText}`);
        showPriorityModal = false;
      }
    } catch (error) {
      handleOperationError(error, '更新重要程度', '更新失败');
    }
  }

  function cancelChangePriority() {
    showPriorityModal = false;
  }

  // 查看详情信息
  function handleOpenDetailedView() {
    if (!currentQuestion) return;
    showDetailModal = true;
  }

  // 处理题目学习顺序切换
  function handleQuestionOrderChange(newOrder: 'sequential' | 'random') {
    questionOrder = newOrder;
    
    // 提示用户：顺序将在下次学习时生效
    new Notice(
      `题目学习顺序已切换为"${newOrder === 'sequential' ? '顺序学习' : '随机学习'}"，将在下次开始学习时生效`,
      3000
    );
  }

  // 处理导航列数模式切换
  function handleNavColumnModeChange(mode: 1 | 3) {
    navColumnMode = mode;
    new Notice(`导航栏已切换为${mode === 1 ? '单列' : '三列'}显示`);
  }

  // 处理紧凑模式切换
  function handleCompactModeSettingChange(setting: 'auto' | 'fixed') {
    compactModeSetting = setting;
    
    if (setting === 'fixed') {
      compactMode = true;
      new Notice('侧边栏已切换为固定紧凑模式（仅显示图标）');
    } else {
      compactMode = false;
      new Notice('侧边栏已切换为自动调整模式');
    }
  }

  function checkSidebarCompactMode() {
    if (!sidebarContentEl) return;
    const toolbarEl = sidebarContentEl.querySelector('.weave-vertical-toolbar') as HTMLElement | null;
    if (!toolbarEl) return;
    const diff = toolbarEl.scrollHeight - toolbarEl.clientHeight;
    compactMode = diff > 8;
  }

  $effect(() => {
    if (!showSidebar) return;

    if (compactModeSetting === 'fixed') {
      compactMode = true;
      return;
    }

    tick().then(() => {
      checkSidebarCompactMode();

      if (!sidebarContentEl) return;
      const toolbarEl = sidebarContentEl.querySelector('.weave-vertical-toolbar') as HTMLElement | null;
      if (!toolbarEl) return;

      sidebarResizeObserver?.disconnect();
      sidebarResizeObserver = new ResizeObserver(() => {
        checkSidebarCompactMode();
      });
      sidebarResizeObserver.observe(toolbarEl);
    });

    return () => {
      sidebarResizeObserver?.disconnect();
      sidebarResizeObserver = null;
    };
  });

  // 退出测试
  async function handleExit() {
    //  修复：如果正在编辑，先保存再退出
    if (showEditModal && editorPoolManager) {
      //  使用 Obsidian Modal 代替 confirm()，避免焦点劫持问题
      const confirmExit = await showObsidianConfirm(
        plugin.app,
        "检测到正在编辑，是否保存并退出？",
        { title: '确认退出', confirmText: '保存并退出' }
      );
      if (!confirmExit) return;
      
      try {
        // 保存编辑内容
        await exitEditMode();
        logger.debug('[QuestionBankStudyInterface] 已保存编辑内容');
      } catch (error) {
        logger.error('[QuestionBankStudyInterface] 保存编辑内容失败:', error);
        new Notice('保存失败，退出已取消');
        return;
      }
    }
    
    //  使用 Obsidian Modal 代替 confirm()，避免焦点劫持问题
    const confirmed = await showObsidianConfirm(
      plugin.app,
      "确定要退出测试吗？当前进度将被保存。",
      { title: '确认退出', confirmText: '退出' }
    );
    if (!confirmed) return;

    if (sessionManager) {
      await sessionManager.cancelSession();
    }
    
    stopTimer();
    
    if (onExit) {
      onExit();
    }
  }

  // 跳转到指定题目
  async function handleJumpToQuestion(index: number) {
    if (!sessionManager) return;
    
    try {
      await sessionManager.jumpToQuestion(index);
      //  修复：使用刷新方法从数据库加载最新数据
      currentQuestion = await sessionManager.getCurrentQuestionWithRefresh();
      
      //  修复：统一答案状态判断逻辑
      if (currentQuestion) {
        userAnswer = currentQuestion.userAnswer || null;
        hasSubmitted = currentQuestion.isCorrect !== null && currentQuestion.isCorrect !== undefined;
      } else {
        userAnswer = null;
        hasSubmitted = false;
      }
      
      currentSession = sessionManager.getCurrentSession();
      
      //  调试日志：记录跳转后的状态
      logger.debug('[QuestionBankStudyInterface] 跳转到题目:', {
        index,
        hasSubmitted,
        isCorrect: currentQuestion?.isCorrect,
        userAnswer: currentQuestion?.userAnswer
      });
    } catch (error) {
      handleOperationError(error, '跳转题目', '跳转失败');
    }
  }

  // 暂停/继续倒计时
  function handleTogglePause() {
    isPaused = !isPaused;
  }

  // 初始化考试倒计时
  function initExamTimer() {
    if (currentSession?.mode === 'exam' || currentSession?.mode === 'quiz') {
      examStartTime = Date.now();
      remainingTime = examDuration;
    }
  }

  // 更新倒计时
  $effect(() => {
    if ((currentSession?.mode === 'exam' || currentSession?.mode === 'quiz') && examStartTime > 0 && !isPaused) {
      const interval = setInterval(() => {
        const elapsed = Date.now() - examStartTime;
        remainingTime = Math.max(0, examDuration - elapsed);
        
        // 时间到，先停止计时器再自动提交，防止重复调用
        if (remainingTime === 0) {
          clearInterval(interval);
          handleCompleteTest();
        }
      }, 100);
      
      return () => clearInterval(interval);
    }
  });

  // 计时器
  function startTimer() {
    timerInterval = window.setInterval(() => {
      elapsedSeconds++;
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      window.clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // 格式化时间
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // 解析题目选项
  function parseOptions(content: string): Array<{ id: string; text: string }> {
    const lines = content.split('\n');
    const options: Array<{ id: string; text: string }> = [];

    for (const line of lines) {
      const match = line.match(/^([A-Z])[.、)]\s*(.+)$/);
      if (match) {
        options.push({
          id: match[1],
          text: match[2].trim()
        });
      }
    }

    return options;
  }

  // 提取题干（移除 YAML frontmatter）
  function extractStem(content: string): string {
    //  修复：先移除 YAML frontmatter，参考记忆学习界面
    const bodyContent = extractBodyContent(content);
    const lines = bodyContent.split('\n');
    const stemLines: string[] = [];

    for (const line of lines) {
      if (/^[A-Z][.、)]/.test(line)) {
        break;
      }
      stemLines.push(line);
    }

    return stemLines.join('\n').trim();
  }

  // 判断是否为多选题
  //  修复：使用实时解析的选择题数据，而不是依赖可能过时的元数据
  function isMultipleChoice(_question: Card): boolean {
    // 优先使用实时解析的结果
    if (choiceQuestionDerived?.isMultipleChoice !== undefined) {
      return choiceQuestionDerived.isMultipleChoice;
    }
    // 降级：检查元数据（可能不准确，尤其是编辑后）
    return _question.metadata?.questionMetadata?.type === 'multiple_choice';
  }

  // 处理单选答案
  function handleSingleChoiceSelect(optionId: string) {
    if (hasSubmitted) return;
    userAnswer = optionId;
  }

  // 处理多选答案
  function handleMultipleChoiceToggle(optionId: string) {
    if (hasSubmitted) return;

    if (!Array.isArray(userAnswer)) {
      userAnswer = [];
    }

    const index = userAnswer.indexOf(optionId);
    if (index > -1) {
      userAnswer = userAnswer.filter(id => id !== optionId);
    } else {
      userAnswer = [...userAnswer, optionId];
    }
  }

  // 获取进度信息
  const progress = $derived.by(() => {
    return sessionManager?.getProgress() || {
      current: 1,
      total: questions.length,
      percentage: 0,
      answered: 0,
      unanswered: questions.length
    };
  });

  // 获取统计信息
  const stats = $derived.by(() => {
    if (!currentSession) {
      return { correctCount: 0, wrongCount: 0, accuracy: 0 };
    }
    return {
      correctCount: currentSession.correctCount,
      wrongCount: currentSession.wrongCount,
      accuracy: currentSession.correctCount + currentSession.wrongCount > 0
        ? (currentSession.correctCount / (currentSession.correctCount + currentSession.wrongCount)) * 100
        : 0
    };
  });

  // 计算平均用时
  const averageTime = $derived.by(() => {
    if (!currentSession || currentSession.completedQuestions === 0) {
      return 0;
    }
    return elapsedSeconds / currentSession.completedQuestions * 1000;
  });


  // 初始化
  onMount(async () => {
    initSession();
    
    // 初始化EmbeddableEditorManager（旧嵌入式方案：embedRegistry，无文件池）
    try {
      const { EmbeddableEditorManager } = await import("../../services/editor/EmbeddableEditorManager");
      editorPoolManager = new EmbeddableEditorManager(plugin.app);
    } catch (error) {
      handleOperationError(error, '初始化编辑器管理器');
      tempFileUnavailable = true;
    }
    
    //  设置移动端回调
    if (isMobile && viewInstance) {
      viewInstance.setMobileMenuCallback(handleShowMobileMenu);
      viewInstance.setToggleStatsBarCallback(() => { showMobileStatsBar = !showMobileStatsBar; });
      viewInstance.setToggleNavigatorCallback(() => { showNavigator = !showNavigator; });
      logger.debug('[QuestionBankStudyInterface] 移动端回调已设置');
    }
  });

  // 清理
  onDestroy(() => {
    stopTimer();
  });

  $effect(() => {
    if (!(Platform.isMobile && showEditModal)) {
      if (mobileViewportCleanup) {
        mobileViewportCleanup();
        mobileViewportCleanup = null;
      }
      mobileViewportHeight = null;
      isKeyboardVisible = false;
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const updateViewportHeight = () => {
      const availableHeight = viewport.height - OBSIDIAN_MOBILE_HEADER_HEIGHT;
      mobileViewportHeight = Math.max(200, availableHeight);

      const keyboardHeight = Math.max(0, window.innerHeight - viewport.height);
      isKeyboardVisible = keyboardHeight > 150;
    };

    updateViewportHeight();

    viewport.addEventListener('resize', updateViewportHeight);
    viewport.addEventListener('scroll', updateViewportHeight);

    mobileViewportCleanup = () => {
      viewport.removeEventListener('resize', updateViewportHeight);
      viewport.removeEventListener('scroll', updateViewportHeight);
    };

    return () => {
      mobileViewportCleanup?.();
      mobileViewportCleanup = null;
    };
  });

  // 打开题目数据结构调试窗口
  function handleOpenCardDebug() {
    if (!currentQuestion) return;
    showCardDebug = true;
  }

  //  显示移动端多功能菜单
  function handleShowMobileMenu() {
    if (!currentQuestion) return;
    
    // 构建菜单配置
    const menuConfig: QuestionBankMenuConfig = {
      card: currentQuestion.question,
      hasSourceFile: !!currentQuestion.question.sourceFile,
      currentPriority: currentQuestion.question.priority || 2,
      enableDirectDelete,
      showStatsBar: showMobileStatsBar,
      questionOrder,
      navColumnMode,
      showNavigator //  题目导航栏状态
    };

    // 构建回调函数
    const menuCallbacks: QuestionBankMenuCallbacks = {
      onToggleEdit: handleToggleEdit,
      onDelete: handleDeleteCard,
      onToggleFavorite: handleToggleFavorite,
      onChangePriority: handleChangePriority,
      onOpenDetailedView: handleOpenDetailedView,
      onOpenCardDebug: handleOpenCardDebug,
      onToggleStatsBar: () => { showMobileStatsBar = !showMobileStatsBar; },
      onToggleNavigator: () => { showNavigator = !showNavigator; }, //  切换题目导航栏
      onQuestionOrderChange: handleQuestionOrderChange,
      onNavColumnModeChange: handleNavColumnModeChange,
      onDirectDeleteToggle: (enabled) => { enableDirectDelete = enabled; }
    };

    // 创建菜单构建器并显示
    const menuBuilder = new QuestionBankMenuBuilder(menuConfig, menuCallbacks);
    menuBuilder.showMenu({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
  }
</script>

<div
  class="question-bank-study-interface-overlay"
  class:edit-active={showEditModal}
  class:keyboard-visible={isKeyboardVisible}
  style={Platform.isMobile && showEditModal && mobileViewportHeight
    ? `height: ${mobileViewportHeight}px; --weave-viewport-height: ${mobileViewportHeight}px;`
    : ''}
>
  <div class="question-bank-study-interface-content">
    {#if isLoading}
      <!-- 加载状态 -->
      <div class="loading-state">
        <div class="spinner"></div>
        <p>正在准备测试...</p>
      </div>
    {:else if currentSession && currentQuestion}
      <!-- 头部工具栏 -->
      <QuestionBankHeader
        {bankName}
        currentIndex={progress.current}
        totalQuestions={progress.total}
        {statsCollapsed}
        {showSidebar}
        {showNavigator}
        showStatsBar={showMobileStatsBar}
        onToggleStats={() => statsCollapsed = !statsCollapsed}
        onToggleSidebar={() => showSidebar = !showSidebar}
        onToggleNavigator={() => showNavigator = !showNavigator}
        onToggleStatsBar={() => showMobileStatsBar = !showMobileStatsBar}
        onShowMobileMenu={handleShowMobileMenu}
        onClose={handleExit}
        mode={currentSession.mode}
        {remainingTime}
        {isPaused}
        {isTimeWarning}
        onTogglePause={handleTogglePause}
      />

      <!--  移动端答题情况信息栏 -->
      {#if isMobile}
        <MobileQuestionStatsBar
          expanded={showMobileStatsBar}
          correctCount={currentSession.correctCount}
          wrongCount={currentSession.wrongCount}
          accuracy={stats.accuracy}
          currentTime={elapsedSeconds}
          totalQuestions={currentSession.totalQuestions}
          completedQuestions={currentSession.completedQuestions}
        />
      {/if}

      <!--  移动端题目导航弹出层 - 简洁网格设计 -->
      {#if isMobile && showNavigator && currentSession}
        <div class="mobile-navigator-overlay" role="presentation">
          <button
            type="button"
            class="mobile-navigator-backdrop"
            aria-label="关闭题目导航"
            onclick={() => showNavigator = false}
          ></button>
          <div class="mobile-nav-grid-panel" role="dialog" aria-modal="true" tabindex="-1">
            <div class="mobile-nav-grid-scroll">
              <div class="mobile-nav-grid">
                {#each currentSession.questions as record, index}
                  {@const status = index === (sessionManager?.getCurrentIndex() || 0) 
                    ? 'current' 
                    : record.isCorrect === true 
                      ? 'correct' 
                      : record.isCorrect === false 
                        ? 'wrong' 
                        : 'unanswered'}
                  <button
                    class="mobile-nav-cell {status}"
                    onclick={() => { handleJumpToQuestion(index); showNavigator = false; }}
                  >
                    {index + 1}
                  </button>
                {/each}
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- 主要内容区域 -->
      <div class="study-content" class:with-navigator={showNavigator} class:with-sidebar={showSidebar}>
      
      <!-- 左侧题目导航栏 -->
      {#if showNavigator && currentSession}
        <div class="navigator-sidebar">
          <QuestionNavigator
            questions={currentSession.questions}
            currentIndex={sessionManager?.getCurrentIndex() || 0}
            onJumpToQuestion={handleJumpToQuestion}
            columnMode={navColumnMode}
          />
        </div>
      {/if}
      
      <!-- 主学习区域 -->
      <div class="main-study-area">
        <!-- 统计卡片（可折叠）-  移动端隐藏，使用MobileQuestionStatsBar代替 -->
        {#if !statsCollapsed && !isMobile}
          <QuestionBankStatsCards 
            session={currentSession} 
            currentQuestion={currentQuestion} 
          />
        {/if}

        <!-- 题目学习区域 -->
        <div class="card-study-container">
          <div class="card-container">
            <!-- 重要程度贴纸 - 显示在右上角 -->
            {#if currentQuestion?.question?.priority}
              <ImportanceIndicator 
                importance={currentQuestion.question.priority}
                sticky={true}
              />
            {/if}
            
            {#if showEditModal}
              <!-- 编辑器模式 -->
              <CardEditorContainer
                card={currentQuestion.question}
                realCardId={currentQuestion.question.uuid}
                editorSessionId={editorSessionId}
                {showEditModal}
                tempFileUnavailable={tempFileUnavailable}
                isClozeMode={isClozeMode}
                editorPoolManager={editorPoolManager}
                dataStorage={plugin.dataStorage}
                modalRef={null}
                statsCollapsed={false}
                keyboardVisible={isKeyboardVisible}
                onKeyboardStateChange={(visible) => {
                  isKeyboardVisible = visible;
                }}
                onEditComplete={handleEditorComplete}
                onEditCancel={handleEditorCancel}
                onToggleCloze={handleToggleCloze}
              />
            {:else}
            <!-- 题目区域 -->
            <div class="question-area">
      <!-- 题干 -->
      <div class="question-stem">
        <div class="question-header">
          {#if currentQuestion.question.difficulty}
            <span class="difficulty-badge {currentQuestion.question.difficulty}">
              {currentQuestion.question.difficulty === 'easy' ? '简单' : 
               currentQuestion.question.difficulty === 'medium' ? '中等' : '困难'}
            </span>
          {/if}
          {#if isMultipleChoice(currentQuestion.question)}
            <span class="question-type">多选题</span>
          {:else}
            <span class="question-type">单选题</span>
          {/if}
        </div>
        <div class="question-content">
          {#if choiceQuestionDerived}
            <CardContentView
              plugin={plugin}
              content={currentQuestion.question.content}
              sourcePath={currentQuestion.question.sourceFile || ''}
              section="stem"
              showAnswer={false}
            />
          {:else}
            <ObsidianRenderer
              {plugin}
              content={extractStem(currentQuestion.question.content)}
              sourcePath={currentQuestion.question.sourceFile || ''}
            />
          {/if}
        </div>
      </div>

      <!-- 选项区域 -->
      <div class="options-area">
        {#if choiceQuestionDerived}
          <CardContentView
            plugin={plugin}
            content={currentQuestion.question.content}
            sourcePath={currentQuestion.question.sourceFile || ''}
            section="options"
            {userAnswer}
            {hasSubmitted}
            onSingleSelect={handleSingleChoiceSelect}
            onMultipleToggle={handleMultipleChoiceToggle}
          />
        {:else}
          <!-- 降级渲染：使用旧版本解析，统一使用ChoiceOptionRenderer保持样式一致 -->
          {#each parseOptions(currentQuestion.question.content) as option}
            {@const isMultiple = isMultipleChoice(currentQuestion.question)}
            {@const isSelected = isMultiple 
              ? Array.isArray(userAnswer) && userAnswer.includes(option.id)
              : userAnswer === option.id}
            {@const isCorrectOption = hasSubmitted && 
              (Array.isArray(currentQuestion.correctAnswer) 
                ? currentQuestion.correctAnswer.includes(option.id)
                : currentQuestion.correctAnswer === option.id)}
            
            {@const showAsCorrect = isCorrectOption && isSelected}
            {@const showAsWrong = hasSubmitted && (
              (isCorrectOption && !isSelected) ||
              (!isCorrectOption && isSelected)
            )}

            {@const badgeText = hasSubmitted 
              ? (isCorrectOption && isSelected ? '你选对了' 
                : !isCorrectOption && isSelected ? '你选错了'
                : isCorrectOption && !isSelected ? '漏选'
                : '')
              : ''}
            {@const badgeIcon = hasSubmitted 
              ? (isCorrectOption && isSelected ? 'check' 
                : !isCorrectOption && isSelected ? 'x'
                : isCorrectOption && !isSelected ? 'alert-circle'
                : '')
              : ''}

            <ChoiceOptionRenderer
              option={{ label: option.id, content: option.text, isCorrect: isCorrectOption }}
              isSelected={isSelected}
              isCorrect={showAsCorrect}
              isWrong={showAsWrong}
              disabled={hasSubmitted}
              badgeText={badgeText}
              badgeIcon={badgeIcon}
              {plugin}
              sourcePath={currentQuestion.question.sourceFile || ''}
              onclick={() => isMultiple 
                ? handleMultipleChoiceToggle(option.id)
                : handleSingleChoiceSelect(option.id)}
            />
          {/each}
        {/if}
      </div>

      <!-- 解析区域（提交答案后显示，从content动态解析---div---后的内容） -->
      {#if hasSubmitted && choiceQuestionDerived?.explanation}
        <div class="explanation-area">
          <div class="explanation-header">
            <EnhancedIcon name="lightbulb" size="18" />
            <span class="explanation-title">答案解析</span>
          </div>
          <div class="explanation-content">
            <CardContentView
              plugin={plugin}
              content={currentQuestion.question.content}
              sourcePath={currentQuestion.question.sourceFile || ''}
              section="explanation"
              showAnswer={true}
            />
          </div>
        </div>
      {/if}
            </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- 右侧垂直工具栏 -->
      {#if showSidebar}
        <div class="sidebar-content" bind:this={sidebarContentEl}>
          <QuestionBankVerticalToolbar
            card={currentQuestion.question}
            currentCardTime={elapsedSeconds * 1000}
            averageTime={averageTime}
            {navColumnMode}
            onNavColumnModeChange={handleNavColumnModeChange}
            {questionOrder}
            onQuestionOrderChange={handleQuestionOrderChange}
            {compactMode}
            {compactModeSetting}
            onCompactModeSettingChange={handleCompactModeSettingChange}
            {plugin}
            onToggleEdit={handleToggleEdit}
            isEditing={showEditModal}
            onDelete={handleDeleteCard}
            onToggleFavorite={handleToggleFavorite}
            onChangePriority={handleChangePriority}
            {enableDirectDelete}
            onDirectDeleteToggle={(enabled) => enableDirectDelete = enabled}
            onOpenDetailedView={handleOpenDetailedView}
            onOpenCardDebug={handleOpenCardDebug}
          />
        </div>
      {/if}

      <!-- 底部功能栏 -->
      <div class="study-footer">
        <div class="footer-actions">
          <div class="footer-left-actions">
            <!-- 题目导航折叠按钮 -->
            <button
              class="nav-toggle-btn"
              onclick={() => showNavigator = !showNavigator}
              title={showNavigator ? '隐藏题目导航' : '显示题目导航'}
            >
              <EnhancedIcon name={showNavigator ? 'panel-left-close' : 'panel-left-open'} size={20} />
            </button>

            <!-- 撤销按钮 -->
            <button
              class="undo-btn"
              onclick={handleUndoAnswer}
              disabled={!canUndo}
              title={canUndo ? `撤销答案 (剩余${maxUndoCount - undoCount}次)` : '无法撤销'}
            >
              <EnhancedIcon name="undo" size={20} />
              {#if maxUndoCount > 0 && (maxUndoCount - undoCount) > 0}
                <span class="undo-badge">{maxUndoCount - undoCount}</span>
              {/if}
            </button>
          </div>

          <div class="footer-center-actions">
            <QuestionBankActionSection
              hasSubmitted={hasSubmitted}
              hasAnswer={!!userAnswer && (Array.isArray(userAnswer) ? userAnswer.length > 0 : true)}
              isLastQuestion={progress.current === progress.total}
              onSubmit={handleSubmitAnswer}
              onNext={handleNextQuestion}
              canUndo={canUndo}
              undoRemaining={maxUndoCount - undoCount}
              onUndo={handleUndoAnswer}
            />
          </div>
        </div>
      </div>
      </div>
    {/if}
  </div>
</div>

<!-- 优先级设置模态窗 -->
{#if showPriorityModal}
  <div class="modal-overlay" role="presentation">
    <button
      type="button"
      class="modal-backdrop"
      aria-label="关闭重要程度设置"
      onclick={() => showPriorityModal = false}
    ></button>
    <div class="priority-modal" role="dialog" aria-modal="true" aria-labelledby="priority-modal-title" tabindex="-1">
      <div class="modal-header">
        <h3 id="priority-modal-title">设置重要程度</h3>
        <button class="modal-close" onclick={() => showPriorityModal = false}>×</button>
      </div>

      <div class="modal-body">
        <p class="modal-description">选择当前题目的重要程度：</p>

        <div class="priority-buttons">
          <button
            class="priority-btn-item priority-low"
            class:selected={selectedPriority === 1}
            onclick={() => selectedPriority = 1}
          >
            <div class="priority-btn-left">
              <div class="priority-icon">!</div>
              <div class="priority-label">低</div>
            </div>
            <div class="priority-radio"></div>
          </button>

          <button
            class="priority-btn-item priority-medium"
            class:selected={selectedPriority === 2}
            onclick={() => selectedPriority = 2}
          >
            <div class="priority-btn-left">
              <div class="priority-icon">!!</div>
              <div class="priority-label">中</div>
            </div>
            <div class="priority-radio"></div>
          </button>

          <button
            class="priority-btn-item priority-high"
            class:selected={selectedPriority === 3}
            onclick={() => selectedPriority = 3}
          >
            <div class="priority-btn-left">
              <div class="priority-icon">!!!</div>
              <div class="priority-label">高</div>
            </div>
            <div class="priority-radio"></div>
          </button>

          <button
            class="priority-btn-item priority-urgent"
            class:selected={selectedPriority === 4}
            onclick={() => selectedPriority = 4}
          >
            <div class="priority-btn-left">
              <div class="priority-icon">[4]</div>
              <div class="priority-label">极高</div>
            </div>
            <div class="priority-radio"></div>
          </button>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => showPriorityModal = false}>
          取消
        </button>
        <button class="btn-primary" onclick={confirmChangePriority}>
          确认设置
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 题目数据结构调试窗口 -->
{#if currentQuestion && showCardDebug}
  <CardDebugModal
    card={currentQuestion.question}
    onClose={() => showCardDebug = false}
  />
{/if}

<!-- 卡片详情模态窗 -->
{#if currentQuestion && showDetailModal}
  <QuestionBankCardDetailModal
    open={showDetailModal}
    card={currentQuestion.question}
    {plugin}
    onClose={() => showDetailModal = false}
  />
{/if}

<style>
  .question-bank-study-interface-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(17, 17, 17, 0.88);
    backdrop-filter: blur(8px);
    z-index: var(--weave-z-float);
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--weave-study-view-spacing, 12px);
  }

  .question-bank-study-interface-content {
    background: var(--background-primary);
    border-radius: var(--radius-l, 12px);
    width: 100%;
    max-width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    box-shadow: var(--weave-shadow-xl);
    border: 1px solid var(--background-modifier-border);
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
  }

  /* 加载状态 */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* 主要内容区域 - Grid布局 */
  .study-content {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr; /* 默认单列布局 */
    grid-template-rows: 1fr auto; /* 内容区自适应 + 底部栏 */
    overflow: hidden;
    transition: all 0.3s ease;
    min-height: 0;
  }

  /* 左侧导航栏显示 */
  .study-content.with-navigator {
    grid-template-columns: auto 1fr; /* 导航栏自适应 + 主内容 */
  }

  /* 右侧工具栏显示 */
  .study-content.with-sidebar {
    grid-template-columns: 1fr auto; /* 主内容 + 工具栏 */
  }

  /* 三列布局：导航栏 + 主内容 + 工具栏 */
  .study-content.with-navigator.with-sidebar {
    grid-template-columns: auto 1fr auto;
  }

  /* 左侧导航栏容器 */
  .navigator-sidebar {
    grid-column: 1;
    grid-row: 1;
    border-right: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    height: 100%;
    overflow: hidden;
  }

  /* 主学习区域 */
  .main-study-area {
    grid-column: 1;
    grid-row: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  /* 有导航栏时，主区域在第二列 */
  .study-content.with-navigator .main-study-area {
    grid-column: 2;
  }

  /* 有导航栏+工具栏时，主区域还是第二列 */
  .study-content.with-navigator.with-sidebar .main-study-area {
    grid-column: 2;
  }

  /* 侧边栏内容容器 */
  .sidebar-content {
    grid-column: 2;
    grid-row: 1;
    display: flex;
    flex-direction: column;
    width: 70px;
    flex-shrink: 0;
    height: 100%;
    overflow: hidden;
  }

  /* 有导航栏时，工具栏在第三列 */
  .study-content.with-navigator .sidebar-content {
    grid-column: 3;
  }

  /* 卡片学习容器 */
  .card-study-container {
    flex: 1;
    padding: var(--weave-space-md, 1rem);
    overflow: visible;
    display: flex;
    align-items: stretch;
    justify-content: center;
    min-height: 0;
  }

  .card-container {
    position: relative;
    width: min(100%, 1300px);
    max-width: 100%;
    height: 100%;
    border: none;
    border-radius: 0;
    padding: var(--weave-space-md);
    background: transparent;
    box-shadow: none;
    display: flex;
    flex-direction: column;
    gap: 0;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* 题目区域 */
  .question-area {
    flex: 1;
    padding: 2rem 1.5rem;
    overflow-y: auto;
    position: relative;
  }

  .question-stem {
    margin-bottom: 2rem;
  }

  .question-header {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .difficulty-badge,
  .question-type {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .difficulty-badge.easy {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .difficulty-badge.medium {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
  }

  .difficulty-badge.hard {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .question-type {
    background: var(--background-secondary);
    color: var(--text-muted);
  }

  .question-content {
    font-size: 1.1rem;
    line-height: 1.8;
    color: var(--text-normal);
    white-space: pre-wrap;
  }

  /* 选项区域 */
  .options-area {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* 解析区域 */
  .explanation-area {
    margin-top: 2rem;
    padding: 1.5rem;
    background: var(--background-secondary);
    border-radius: 12px;
    border: 2px solid var(--background-modifier-border);
  }

  .explanation-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid var(--background-modifier-border);
  }

  .explanation-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .explanation-content {
    font-size: 1rem;
    line-height: 1.8;
    color: var(--text-normal);
  }

  /* 解析内容中的段落和列表样式 */
  .explanation-content :global(p) {
    margin: 0.75rem 0;
  }

  .explanation-content :global(p:first-child) {
    margin-top: 0;
  }

  .explanation-content :global(p:last-child) {
    margin-bottom: 0;
  }

  .explanation-content :global(ul),
  .explanation-content :global(ol) {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  .explanation-content :global(li) {
    margin: 0.5rem 0;
  }

  .explanation-content :global(code) {
    background: var(--code-background);
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 0.9em;
  }

  .explanation-content :global(pre) {
    background: var(--code-background);
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
    margin: 1rem 0;
  }

  /* 底部功能栏 - 桌面端样式 */
  .study-footer {
    grid-column: 1 / -1; /* 跨越所有列 */
    grid-row: 2;
    padding: 1rem 1.5rem 1.25rem;
  }

  /*  桌面端：有背景和边框 */
  :global(body:not(.is-mobile)) .study-footer {
    background: var(--background-primary);
    border-top: 1px solid var(--background-modifier-border);
  }

  /*  移动端：透明无边框 */
  :global(body.is-mobile) .study-footer {
    background: transparent;
    border: none;
  }

  /* 有导航栏时，底部栏依然横跨所有列，保持左侧零边距 */
  .study-content.with-navigator .study-footer {
    grid-column: 1 / -1;
  }

  .footer-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    max-width: 1300px;
    margin: 0 auto;
  }

  .footer-left-actions {
    display: flex;
    gap: 0.5rem;
  }

  .footer-center-actions {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  /* 导航切换按钮 */
  .nav-toggle-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0.5rem;
    background: transparent;
    border: none;
    outline: none;
    border-radius: 8px;
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .nav-toggle-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--interactive-accent);
    transform: translateY(-2px);
  }
  
  .nav-toggle-btn:focus {
    outline: none;
    border: none;
  }
  
  .nav-toggle-btn:active {
    border: none;
  }

  /* 撤销按钮 - 渐变紫色角标 */
  .undo-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0.5rem;
    background: transparent;
    border: none;
    outline: none;
    border-radius: 8px;
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .undo-btn:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    color: var(--interactive-accent);
    transform: translateY(-2px);
  }
  
  .undo-btn:focus {
    outline: none;
    border: none;
  }
  
  .undo-btn:active {
    border: none;
  }

  .undo-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* 渐变紫色角标 */
  .undo-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 11px;
    font-size: 12px;
    font-weight: 700;
    box-shadow: 0 2px 12px rgba(102, 126, 234, 0.5);
    border: 2px solid var(--background-primary);
    pointer-events: none;
  }

  .undo-btn:disabled .undo-badge {
    opacity: 0.5;
    background: linear-gradient(135deg, #888 0%, #666 100%);
    box-shadow: none;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.2s;
  }

  .nav-btn:hover:not(:disabled) {
    background: var(--background-modifier-hover);
  }

  .nav-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 桌面端不进行布局重排，侧边栏始终在右侧 */
  /* 移动端布局由 :global(body.is-mobile) 控制 */

  /* 优先级模态窗样式 */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--weave-z-sticky);
    backdrop-filter: blur(2px);
    pointer-events: none;
  }

  .modal-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: transparent;
    padding: 0;
    cursor: default;
    pointer-events: auto;
  }

  .priority-modal {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    box-shadow: var(--shadow-s);
    max-width: 450px;
    min-width: 350px;
    pointer-events: auto;
    max-height: 80vh;
    overflow: hidden;
    animation: bounceIn 0.3s ease-out;
  }

  @keyframes bounceIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .modal-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.25rem;
    font-size: 1.2rem;
    line-height: 1;
    transition: all 0.15s ease;
  }

  .modal-close:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-description {
    margin: 0 0 1rem 0;
    color: var(--text-normal);
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .priority-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .priority-btn-item {
    background: var(--background-secondary);
    border: 2px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 14px 20px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .priority-btn-item:hover {
    background: var(--background-modifier-hover);
    border-color: currentColor;
    transform: scale(1.02);
  }

  .priority-btn-item.selected {
    background: var(--background-modifier-hover);
    border-color: currentColor;
    border-width: 2px;
  }

  .priority-btn-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .priority-icon {
    font-size: 24px;
    font-weight: bold;
    letter-spacing: -2px;
    min-width: 40px;
  }

  .priority-label {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-normal);
  }

  .priority-radio {
    width: 20px;
    height: 20px;
    border: 2px solid #666;
    border-radius: 50%;
    position: relative;
    flex-shrink: 0;
    transition: all 0.2s;
  }

  .priority-btn-item:hover .priority-radio {
    border-color: currentColor;
  }

  .priority-btn-item.selected .priority-radio {
    border-color: currentColor;
    background: currentColor;
  }

  .priority-btn-item.selected .priority-radio::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 8px;
    background: white;
    border-radius: 50%;
  }

  .priority-low {
    color: #22c55e;
  }

  .priority-medium {
    color: #eab308;
  }

  .priority-high {
    color: #f97316;
  }

  .priority-urgent {
    color: #ef4444;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0) scale(1.02); }
    25% { transform: translateX(-2px) scale(1.02); }
    75% { transform: translateX(2px) scale(1.02); }
  }

  .priority-urgent:hover {
    animation: shake 0.5s;
  }

  .modal-footer {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding: 1rem 1.5rem;
    background: var(--background-secondary);
  }

  .btn-secondary,
  .btn-primary {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    border: none;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 80px;
  }

  .btn-secondary {
    background: var(--background-primary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
  }

  .btn-secondary:hover {
    background: var(--background-modifier-hover);
  }

  .btn-primary {
    background: var(--text-accent);
    color: var(--text-on-accent);
  }

  .btn-primary:hover {
    background: color-mix(in srgb, var(--text-accent) 90%, black);
    transform: translateY(-1px);
  }

  /* ==================== Obsidian 移动端适配 ==================== */
  
  /* 所有移动设备通用样式 */
  :global(body.is-mobile) .question-bank-study-interface-overlay {
    /*  修复：移动端使用 relative 定位，让内容自然流动在 Obsidian 视图容器内 */
    position: relative;
    width: 100%;
    height: 100%;
    padding: 0;
    /*  修复：移除背景遮罩，避免覆盖 Obsidian UI */
    background: transparent;
    backdrop-filter: none;
    z-index: 1;
    /*  关键：不使用 fixed/absolute，让 Obsidian 管理顶部/底部栏的避让 */
    overflow: hidden;
  }

  :global(body.is-mobile) .question-bank-study-interface-content {
    /*  修复：使用 100% 而非固定高度，让容器适应 Obsidian 的可用空间 */
    height: 100%;
    max-width: 100%;
    border-radius: 0;
    margin: 0;
    border: none;
    box-shadow: none;
  }

  :global(body.is-mobile) .card-study-container {
    padding: 0;
  }

  :global(body.is-mobile) .card-container {
    padding: var(--weave-mobile-spacing-sm, 0.5rem);
    border: none;
    box-shadow: none;
  }

  :global(body.is-mobile) .study-footer {
    background: transparent !important;
    padding: 0;
    margin: 0;
    border: none !important;
  }

  /* 手机端专用样式 */
  :global(body.is-phone) .study-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  :global(body.is-phone) .question-bank-study-interface-content {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  :global(body.is-phone) .question-bank-study-interface-overlay {
    /*  确保不覆盖 Obsidian 顶部栏 */
    display: flex;
    flex-direction: column;
    /*  移动端隐藏底部导航折叠按钮（移到顶部菜单） */
  }
  
  /*  移动端隐藏底部左侧操作区（导航折叠按钮移到顶部菜单） */
  :global(body.is-phone) .footer-left-actions {
    display: none !important;
  }

  /*  移动端题目导航弹出层样式 - 简洁网格设计 */
  .mobile-navigator-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: var(--weave-z-overlay);
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    animation: fadeIn 0.2s ease;
    padding: 0.5rem;
  }

  .mobile-navigator-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: transparent;
    padding: 0;
    cursor: default;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /*  简洁网格面板 */
  .mobile-nav-grid-panel {
    background: var(--background-primary);
    border-radius: 12px;
    max-height: 70%;
    max-width: calc(100% - 1rem);
    display: flex;
    flex-direction: column;
    animation: slideDown 0.25s ease;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .mobile-nav-grid-scroll {
    overflow-y: auto;
    padding: 0.75rem;
    max-height: 100%;
  }

  /*  网格布局 - 每行6个 */
  .mobile-nav-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
  }

  /*  题号单元格 */
  .mobile-nav-cell {
    aspect-ratio: 1 / 1;
    min-width: 36px;
    min-height: 36px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    padding: 0;
  }

  /* 未答题 - 浅灰背景 */
  .mobile-nav-cell.unanswered {
    background: var(--background-modifier-border);
    color: var(--text-muted);
  }

  .mobile-nav-cell.unanswered:active {
    transform: scale(0.95);
  }

  /* 答对 - 绿色 */
  .mobile-nav-cell.correct {
    background: #22c55e;
    color: white;
  }

  /* 答错 - 红色 */
  .mobile-nav-cell.wrong {
    background: #ef4444;
    color: white;
  }

  /* 当前题 - 蓝色边框高亮 */
  .mobile-nav-cell.current {
    background: #3b82f6;
    color: white;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4);
  }

  .mobile-navigator-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .mobile-navigator-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mobile-navigator-close:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .mobile-navigator-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem);
  }

  .mobile-navigator-content :global(.question-navigator) {
    width: 100%;
    height: auto;
    padding: 0.5rem;
  }

  .mobile-navigator-content :global(.grid-container) {
    grid-template-columns: repeat(5, 1fr) !important;
  }

  /* 手机端隐藏导航栏和侧边栏 */
  :global(body.is-phone) .navigator-sidebar,
  :global(body.is-phone) .sidebar-content {
    display: none !important;
  }

  :global(body.is-phone) .card-container {
    width: 100%;
    border-radius: 0;
    padding: 0.25rem 0;
    margin: 0;
  }

  :global(body.is-phone) .card-study-container {
    padding: 0;
    flex: 1;
    min-height: 0;
  }

  :global(body.is-phone) .study-footer {
    background: transparent;
    padding: 0.5rem 0;
    /*  底部留出足够间距，避免被Obsidian底部导航栏覆盖 */
    padding-bottom: calc(var(--safe-area-inset-bottom, 0px) + 48px);
    margin: 0;
    border: none;
  }

  /*  移动端底部功能栏透明，移除遮罩效果 */
  :global(body.is-phone) .footer-actions {
    background: transparent;
  }

  :global(body.is-phone) .footer-center-actions {
    width: 100%;
  }

  :global(body.is-phone) .main-study-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  /*  考试界面整体底部安全区域 */
  :global(body.is-phone) .question-bank-study-interface-content {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  :global(body.is-phone) .question-bank-study-interface-overlay.edit-active,
  :global(body.is-mobile) .question-bank-study-interface-overlay.edit-active {
    position: fixed;
    top: 44px;
    left: 0;
    right: 0;
    height: var(--weave-viewport-height, 100%);
    overflow: hidden;
    padding: 0;
  }

  :global(body.is-phone) .question-bank-study-interface-overlay.edit-active .question-bank-study-interface-content,
  :global(body.is-mobile) .question-bank-study-interface-overlay.edit-active .question-bank-study-interface-content {
    height: 100%;
    overflow: hidden;
  }

  :global(body.is-phone) .question-bank-study-interface-overlay.edit-active .study-footer,
  :global(body.is-mobile) .question-bank-study-interface-overlay.edit-active .study-footer {
    display: none;
  }

  :global(body.is-phone) .question-bank-study-interface-overlay.edit-active .card-study-container,
  :global(body.is-mobile) .question-bank-study-interface-overlay.edit-active .card-study-container {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 0;
  }

  :global(body.is-phone) .question-bank-study-interface-overlay.edit-active .card-container,
  :global(body.is-mobile) .question-bank-study-interface-overlay.edit-active .card-container {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 0;
  }

  /* 平板端专用样式 */
  :global(body.is-tablet) .question-bank-study-interface-content {
    max-width: 95vw;
    height: 95%;
    border-radius: var(--radius-l, 12px);
  }

  :global(body.is-tablet) .card-container {
    width: min(100%, 1100px);
    padding: var(--weave-mobile-spacing-lg, 1.25rem);
  }
</style>

