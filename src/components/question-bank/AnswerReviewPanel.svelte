<script lang="ts">
  import type { TestSession, TestQuestionRecord } from "../../types/question-bank-types";
  import ObsidianIcon from "../ui/ObsidianIcon.svelte";

  interface Props {
    session: TestSession;
    onClose?: () => void;
  }

  let { session, onClose }: Props = $props();

  // 筛选状态
  let filter = $state<"all" | "correct" | "wrong">("all");
  let expandedQuestions = $state<Set<number>>(new Set());

  // 过滤题目
  const filteredQuestions = $derived(() => {
    if (filter === "all") {
      return session.questions;
    } else if (filter === "correct") {
      return session.questions.filter(q => q.isCorrect === true);
    } else {
      return session.questions.filter(q => q.isCorrect === false);
    }
  });

  // 切换题目展开/收起
  function toggleQuestion(index: number) {
    if (expandedQuestions.has(index)) {
      expandedQuestions.delete(index);
    } else {
      expandedQuestions.add(index);
    }
    expandedQuestions = new Set(expandedQuestions);
  }

  // 展开全部
  function expandAll() {
    expandedQuestions = new Set(session.questions.map((_, i) => i));
  }

  // 收起全部
  function collapseAll() {
    expandedQuestions = new Set();
  }

  // 格式化时间
  function formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}秒`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}分${secs}秒`;
  }

  // 解析题目内容
  function parseStem(content: string): string {
    const lines = content.split('\n');
    const stemLines: string[] = [];
    
    for (const line of lines) {
      if (/^[A-Z][.、)]/.test(line)) {
        break;
      }
      stemLines.push(line);
    }
    
    return stemLines.join('\n').trim();
  }

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

  // 格式化答案
  function formatAnswer(answer: string | string[] | null): string {
    if (!answer) return "未作答";
    if (Array.isArray(answer)) {
      return answer.join(", ");
    }
    return answer;
  }
</script>

<div class="answer-review-panel">
  <!-- 头部工具栏 -->
  <div class="review-header">
    <div class="header-left">
      <h2 class="header-title">答案解析</h2>
      <div class="header-stats">
        <span>{filteredQuestions().length} 题</span>
      </div>
    </div>

    <div class="header-right">
      <!-- 筛选按钮 -->
      <div class="filter-buttons">
        <button
          class="filter-btn"
          class:active={filter === "all"}
          onclick={() => filter = "all"}
        >
          全部 ({session.questions.length})
        </button>
        <button
          class="filter-btn correct"
          class:active={filter === "correct"}
          onclick={() => filter = "correct"}
        >
          <ObsidianIcon name="check" size={14} />
          答对 ({session.correctCount})
        </button>
        <button
          class="filter-btn wrong"
          class:active={filter === "wrong"}
          onclick={() => filter = "wrong"}
        >
          <ObsidianIcon name="x" size={14} />
          答错 ({session.wrongCount})
        </button>
      </div>

      <!-- 展开/收起 -->
      <div class="expand-buttons">
        <button class="icon-btn" onclick={expandAll} title="展开全部">
          <ObsidianIcon name="chevrons-down" size={16} />
        </button>
        <button class="icon-btn" onclick={collapseAll} title="收起全部">
          <ObsidianIcon name="chevrons-up" size={16} />
        </button>
      </div>

      <!-- 关闭按钮 -->
      <button class="close-btn" onclick={() => onClose?.()} title="关闭">
        <ObsidianIcon name="x" size={18} />
      </button>
    </div>
  </div>

  <!-- 题目列表 -->
  <div class="review-content">
    {#if filteredQuestions().length === 0}
      <div class="empty-state">
        <div class="empty-icon">--</div>
        <p>没有找到题目</p>
      </div>
    {:else}
      {#each filteredQuestions() as record, index}
        {@const originalIndex = session.questions.indexOf(record)}
        {@const isExpanded = expandedQuestions.has(originalIndex)}
        {@const options = parseOptions(record.question.content)}
        
        <div class="question-card" class:expanded={isExpanded}>
          <!-- 题目头部 -->
          <button
            class="question-header"
            onclick={() => toggleQuestion(originalIndex)}
          >
            <div class="question-info">
              <!-- 题号和状态 -->
              <div class="question-number">
                <span class="number-text">#{originalIndex + 1}</span>
                {#if record.isCorrect === true}
                  <span class="status-icon correct">
                    <ObsidianIcon name="check-circle" size={18} />
                  </span>
                {:else if record.isCorrect === false}
                  <span class="status-icon wrong">
                    <ObsidianIcon name="x-circle" size={18} />
                  </span>
                {:else}
                  <span class="status-icon skipped">
                    <ObsidianIcon name="minus-circle" size={18} />
                  </span>
                {/if}
              </div>

              <!-- 题干预览 -->
              <div class="question-preview">
                {parseStem(record.question.content).slice(0, 80)}
                {parseStem(record.question.content).length > 80 ? "..." : ""}
              </div>

              <!-- 用时 -->
              <div class="question-time">
                <ObsidianIcon name="clock" size={14} />
                {formatTime(record.timeSpent)}
              </div>
            </div>

            <div class="expand-icon">
              <ObsidianIcon
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={20}
              />
            </div>
          </button>

          <!-- 题目详情（展开时显示） -->
          {#if isExpanded}
            <div class="question-details">
              <!-- 题干 -->
              <div class="detail-section">
                <div class="section-title">题目</div>
                <div class="question-stem">
                  {parseStem(record.question.content)}
                </div>
              </div>

              <!-- 选项 -->
              {#if options.length > 0}
                <div class="detail-section">
                  <div class="section-title">选项</div>
                  <div class="options-list">
                    {#each options as option}
                      {@const isUserAnswer = Array.isArray(record.userAnswer)
                        ? record.userAnswer.includes(option.id)
                        : record.userAnswer === option.id}
                      {@const isCorrectOption = Array.isArray(record.correctAnswer)
                        ? record.correctAnswer.includes(option.id)
                        : record.correctAnswer === option.id}
                      
                      <!--  方案C：用户选择标注模式 - 明确标注用户选择状态 -->
                      {@const showAsCorrect = isCorrectOption && isUserAnswer}
                      {@const isMissed = isCorrectOption && !isUserAnswer}  // 漏选
                      {@const isWrongSelected = !isCorrectOption && isUserAnswer}  // 错选
                      
                      <div
                        class="option-item"
                        class:user-answer={isUserAnswer}
                        class:correct-answer={showAsCorrect}
                        class:wrong-answer={isMissed || isWrongSelected}
                      >
                        <span class="option-label">{option.id}</span>
                        <span class="option-text">{option.text}</span>
                        {#if showAsCorrect}
                          <span class="option-badge correct">
                            <ObsidianIcon name="check" size={14} />
                            你选对了
                          </span>
                        {/if}
                        {#if isWrongSelected}
                          <span class="option-badge wrong">
                            <ObsidianIcon name="x" size={14} />
                            你选错了
                          </span>
                        {/if}
                        {#if isMissed}
                          <span class="option-badge wrong">
                            <ObsidianIcon name="alert-circle" size={14} />
                            漏选
                          </span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- 答题信息 -->
              <div class="detail-section">
                <div class="answer-info-grid">
                  <div class="info-item">
                    <div class="info-label">你的答案</div>
                    <div class="info-value">
                      {formatAnswer(record.userAnswer)}
                    </div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">正确答案</div>
                    <div class="info-value correct">
                      {formatAnswer(record.correctAnswer)}
                    </div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">答题结果</div>
                    <div class="info-value">
                      {#if record.isCorrect === true}
                        <span class="result-badge correct">✓ 正确</span>
                      {:else if record.isCorrect === false}
                        <span class="result-badge wrong">✗ 错误</span>
                      {:else}
                        <span class="result-badge skipped">- 未作答</span>
                      {/if}
                    </div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">用时</div>
                    <div class="info-value">{formatTime(record.timeSpent)}</div>
                  </div>
                </div>
              </div>

              <!-- 答案解析 -->
              {#if record.question.metadata?.questionMetadata?.explanation}
                <div class="detail-section">
                  <div class="section-title">
                    <ObsidianIcon name="lightbulb" size={16} />
                    答案解析
                  </div>
                  <div class="explanation-content">
                    {record.question.metadata.questionMetadata.explanation}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .answer-review-panel {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--background-primary);
  }

  /* 头部 */
  .review-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    gap: 1rem;
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-normal);
    margin: 0;
  }

  .header-stats {
    padding: 0.25rem 0.75rem;
    background: var(--background-primary);
    border-radius: 12px;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  /* 筛选按钮 */
  .filter-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .filter-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    color: var(--text-muted);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .filter-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .filter-btn.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .filter-btn.correct.active {
    background: #22c55e;
    border-color: #22c55e;
  }

  .filter-btn.wrong.active {
    background: #ef4444;
    border-color: #ef4444;
  }

  /* 展开/收起按钮 */
  .expand-buttons {
    display: flex;
    gap: 0.25rem;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* 内容区域 */
  .review-content {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    text-align: center;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  /* 题目卡片 */
  .question-card {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    margin-bottom: 1rem;
    overflow: hidden;
    transition: all 0.2s;
  }

  .question-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .question-card.expanded {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  /* 题目头部 */
  .question-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s;
  }

  .question-header:hover {
    background: var(--background-modifier-hover);
  }

  .question-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }

  .question-number {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .number-text {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    padding: 0.25rem 0.5rem;
    background: var(--background-secondary);
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .status-icon {
    display: flex;
    align-items: center;
  }

  .status-icon.correct {
    color: #22c55e;
  }

  .status-icon.wrong {
    color: #ef4444;
  }

  .status-icon.skipped {
    color: var(--text-muted);
  }

  .question-preview {
    flex: 1;
    font-size: 0.9rem;
    color: var(--text-normal);
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .question-time {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    background: var(--background-secondary);
    border-radius: 12px;
    font-size: 0.8rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .expand-icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  /* 题目详情 */
  .question-details {
    padding: 0 1.25rem 1.25rem;
    border-top: 1px solid var(--background-modifier-border);
  }

  .detail-section {
    margin-top: 1.5rem;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 0.75rem;
  }

  .question-stem {
    padding: 1rem;
    background: var(--background-secondary);
    border-radius: 8px;
    color: var(--text-normal);
    line-height: 1.8;
    white-space: pre-wrap;
  }

  /* 选项列表 */
  .options-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .option-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: var(--background-secondary);
    border: 2px solid transparent;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .option-item.correct-answer {
    background: rgba(34, 197, 94, 0.05);
    border-color: #22c55e;
  }

  .option-item.wrong-answer {
    background: rgba(239, 68, 68, 0.05);
    border-color: #ef4444;
  }

  .option-label {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    background: var(--background-primary);
    border-radius: 50%;
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--text-normal);
  }

  .option-item.correct-answer .option-label {
    background: #22c55e;
    color: white;
  }

  .option-item.wrong-answer .option-label {
    background: #ef4444;
    color: white;
  }

  .option-text {
    flex: 1;
    color: var(--text-normal);
    line-height: 1.6;
  }

  .option-badge {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .option-badge.correct {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .option-badge.wrong {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  /* 答题信息 */
  .answer-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .info-item {
    padding: 1rem;
    background: var(--background-secondary);
    border-radius: 8px;
  }

  .info-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
  }

  .info-value {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-normal);
  }

  .info-value.correct {
    color: #22c55e;
  }

  .result-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .result-badge.correct {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .result-badge.wrong {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .result-badge.skipped {
    background: var(--background-modifier-border);
    color: var(--text-muted);
  }

  /* 答案解析 */
  .explanation-content {
    padding: 1rem;
    background: rgba(59, 130, 246, 0.05);
    border-left: 3px solid #3b82f6;
    border-radius: 8px;
    color: var(--text-normal);
    line-height: 1.8;
    white-space: pre-wrap;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .review-header {
      flex-direction: column;
      align-items: stretch;
    }

    .header-right {
      flex-wrap: wrap;
    }

    .question-info {
      flex-wrap: wrap;
    }

    .question-preview {
      width: 100%;
      white-space: normal;
    }

    .answer-info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>












