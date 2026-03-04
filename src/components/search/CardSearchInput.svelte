<script lang="ts">
  import { onMount } from 'svelte';
  import { Menu, type App } from 'obsidian';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import { ICON_NAMES } from '../../icons/index.js';
  import type { Deck } from '../../data/types';

  type DataSource = 'memory' | 'questionBank' | 'incremental-reading';

  interface Props {
    value?: string;
    placeholder?: string;
    onSearch?: (query: string) => void;
    onClear?: () => void;
    onSort?: (field: string) => void;
    app: App;
    dataSource?: DataSource;
    // 卡片数据统计
    availableDecks?: Deck[];
    availableTags?: string[];
    availablePriorities?: number[];
    availableQuestionTypes?: string[];
    availableSources?: string[];
    availableStatuses?: string[];
    availableStates?: string[];
    availableAccuracies?: string[];
    availableAttemptThresholds?: number[];
    availableErrorLevels?: string[];
    availableSourceCards?: string[];
    availableYamlKeys?: string[];
    // 匹配计数
    matchCount?: number;
    totalCount?: number;
    // 排序状态
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
  }

  let { 
    value = $bindable(''),
    placeholder = '搜索卡片...',
    onSearch,
    onClear,
    onSort,
    app,
    dataSource = 'memory',
    availableDecks = [],
    availableTags = [],
    availablePriorities = [],
    availableQuestionTypes = [],
    availableSources = [],
    availableStatuses = [],
    availableStates = [],
    availableAccuracies = [],
    availableAttemptThresholds = [],
    availableErrorLevels = [],
    availableSourceCards = [],
    availableYamlKeys = [],
    matchCount = -1,
    totalCount = -1,
    sortField = 'created',
    sortDirection = 'desc'
  }: Props = $props();

  let inputRef: HTMLInputElement | null = $state(null);
  let containerRef: HTMLDivElement | null = $state(null);
  let searchHistory = $state<string[]>([]);
  let menuShown = $state(false);
  let showDropdown = $state(false);

  // 搜索选项定义
  const baseSearchOptions = [
    { prefix: 'deck:', label: 'deck: 匹配牌组', afterInsert: () => showDeckSuggestions() },
    { prefix: 'tag:', label: 'tag: 搜索标签', afterInsert: () => showTagSuggestions() },
    { prefix: 'priority:', label: 'priority: 搜索优先级', afterInsert: () => showPrioritySuggestions() },
    { prefix: 'source:', label: 'source: 搜索来源文档', afterInsert: () => showSourceSuggestions() },
    { prefix: 'created:', label: 'created: 创建日期筛选', afterInsert: () => showDateSuggestions('created') },
    { prefix: 'modified:', label: 'modified: 修改日期筛选', afterInsert: () => showDateSuggestions('modified') },
    { prefix: 'due:', label: 'due: 复习到期日筛选', afterInsert: () => showDateSuggestions('due') },
    { prefix: 'yaml:', label: 'yaml: YAML属性筛选', afterInsert: () => showYamlSuggestions() },
  ];

  const dataSourceOptions = $derived.by(() => {
    const opts = [...baseSearchOptions];
    if (dataSource === 'memory') {
      opts.push({ prefix: 'type:', label: 'type: 搜索题型', afterInsert: () => showTypeSuggestions() });
      opts.push({ prefix: 'status:', label: 'status: 搜索状态', afterInsert: () => showStatusSuggestions() });
    } else if (dataSource === 'questionBank') {
      opts.push({ prefix: 'type:', label: 'type: 搜索题型', afterInsert: () => showTypeSuggestions() });
      opts.push({ prefix: 'accuracy:', label: 'accuracy: 搜索正确率', afterInsert: () => showAccuracySuggestions() });
      opts.push({ prefix: 'attempts:', label: 'attempts: 搜索测试次数', afterInsert: () => showAttemptsSuggestions() });
      opts.push({ prefix: 'error:', label: 'error: 搜索错题等级', afterInsert: () => showErrorSuggestions() });
      opts.push({ prefix: 'source_card:', label: 'source_card: 搜索关联卡片', afterInsert: () => showSourceCardSuggestions() });
    } else if (dataSource === 'incremental-reading') {
      opts.push({ prefix: 'state:', label: 'state: 搜索阅读状态', afterInsert: () => showStateSuggestions() });
    }
    return opts;
  });

  function handleInputFocus() {
    showDropdown = true;
  }

  function handleClickOutside(e: MouseEvent) {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      showDropdown = false;
    }
  }

  function removeHistoryItem(item: string, e: MouseEvent) {
    e.stopPropagation();
    searchHistory = searchHistory.filter(h => h !== item);
    saveSearchHistory();
  }

  function clearAllHistory(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    searchHistory = [];
    saveSearchHistory();
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside, true);
    return () => document.removeEventListener('click', handleClickOutside, true);
  });

  // 从 localStorage 加载搜索历史和排序偏好
  onMount(() => {
    try {
      const saved = localStorage.getItem(`weave-search-history-${dataSource}`);
      if (saved) {
        searchHistory = JSON.parse(saved);
      }
    } catch (error) {
      console.error('加载搜索历史失败:', error);
    }
  });
  // NOTE: click-outside listener registered in the onMount above (with showDropdown state)

  // 保存搜索历史
  function saveSearchHistory() {
    try {
      localStorage.setItem(`weave-search-history-${dataSource}`, JSON.stringify(searchHistory));
    } catch (error) {
      console.error('保存搜索历史失败:', error);
    }
  }

  // 添加到搜索历史
  function addToHistory(query: string) {
    if (!query.trim()) return;
    
    searchHistory = searchHistory.filter(item => item !== query);
    searchHistory.unshift(query);
    if (searchHistory.length > 20) {
      searchHistory = searchHistory.slice(0, 20);
    }
    
    saveSearchHistory();
  }

  // 处理输入
  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    value = target.value;
    onSearch?.(value);
    
    // 检测是否输入了搜索前缀
    checkAndShowSuggestions();
  }

  // 检测并显示建议
  function checkAndShowSuggestions() {
    if (!inputRef) return;
    
    const cursorPos = inputRef.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    
    // 检测最后一个词是否是搜索前缀
    const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];
    
    if (lastWord.endsWith('tag:')) {
      showTagSuggestions();
    } else if (lastWord.endsWith('deck:')) {
      showDeckSuggestions();
    } else if (lastWord.endsWith('priority:')) {
      showPrioritySuggestions();
    } else if (lastWord.endsWith('type:')) {
      showTypeSuggestions();
    } else if (lastWord.endsWith('source:')) {
      showSourceSuggestions();
    } else if (lastWord.endsWith('status:')) {
      showStatusSuggestions();
    } else if (lastWord.endsWith('state:')) {
      showStateSuggestions();
    } else if (lastWord.endsWith('accuracy:')) {
      showAccuracySuggestions();
    } else if (lastWord.endsWith('attempts:')) {
      showAttemptsSuggestions();
    } else if (lastWord.endsWith('error:')) {
      showErrorSuggestions();
    } else if (lastWord.endsWith('source_card:')) {
      showSourceCardSuggestions();
    } else if (lastWord.endsWith('created:')) {
      showDateSuggestions('created');
    } else if (lastWord.endsWith('modified:')) {
      showDateSuggestions('modified');
    } else if (lastWord.endsWith('due:')) {
      showDateSuggestions('due');
    } else if (lastWord.endsWith('yaml:')) {
      showYamlSuggestions();
    }
  }

  function showMenuSafe(menu: Menu) {
    if (!containerRef) return;
    menuShown = true;
    const rect = containerRef.getBoundingClientRect();
    menu.onHide(() => {
      menuShown = false;
    });
    menu.showAtPosition({ x: rect.left, y: rect.bottom + 2 });
  }

  function showStatusSuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle('状态');
      item.setDisabled(true);
    });
    const values = availableStatuses.length > 0 ? availableStatuses : ['new', 'learning', 'review', 'relearning'];
    values.forEach((v) => {
      menu.addItem((item) => {
        item.setTitle(v);
        item.onClick(() => {
          replaceLastWord(v);
        });
      });
    });
    showMenuSafe(menu);
  }

  function showStateSuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle('阅读状态');
      item.setDisabled(true);
    });
    const values = availableStates.length > 0 ? availableStates : ['new', 'learning', 'review', 'queued', 'active', 'scheduled', 'done', 'suspended', 'removed'];
    values.slice(0, 20).forEach((v) => {
      menu.addItem((item) => {
        item.setTitle(v);
        item.onClick(() => {
          replaceLastWord(v);
        });
      });
    });
    showMenuSafe(menu);
  }

  function showAccuracySuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle('正确率');
      item.setDisabled(true);
    });
    const values = availableAccuracies.length > 0 ? availableAccuracies : ['high', 'medium', 'low', '80', '60'];
    values.forEach((v) => {
      menu.addItem((item) => {
        item.setTitle(v);
        item.onClick(() => {
          replaceLastWord(v);
        });
      });
    });
    showMenuSafe(menu);
  }

  function showAttemptsSuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle('测试次数');
      item.setDisabled(true);
    });
    const values = availableAttemptThresholds.length > 0 ? availableAttemptThresholds : [1, 3, 5, 10];
    values.forEach((v) => {
      menu.addItem((item) => {
        item.setTitle(`${v}`);
        item.onClick(() => {
          replaceLastWord(`${v}`);
        });
      });
    });
    showMenuSafe(menu);
  }

  function showErrorSuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle('错题等级');
      item.setDisabled(true);
    });
    const values = availableErrorLevels.length > 0 ? availableErrorLevels : ['high', 'common', 'light', 'none'];
    values.forEach((v) => {
      menu.addItem((item) => {
        item.setTitle(v);
        item.onClick(() => {
          replaceLastWord(v);
        });
      });
    });
    showMenuSafe(menu);
  }

  function showSourceCardSuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle('关联卡片');
      item.setDisabled(true);
    });
    if (availableSourceCards.length === 0) {
      menu.addItem((item) => {
        item.setTitle('暂无关联卡片');
        item.setDisabled(true);
      });
    } else {
      availableSourceCards.slice(0, 20).forEach((id) => {
        menu.addItem((item) => {
          item.setTitle(id);
          item.onClick(() => {
            replaceLastWord(`"${id}"`);
          });
        });
      });
    }
    showMenuSafe(menu);
  }

  // 显示日期范围建议（通用：created / modified / due）
  function showDateSuggestions(dateType: 'created' | 'modified' | 'due') {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;

    const titleMap = { created: '创建日期筛选', modified: '修改日期筛选', due: '复习到期日筛选' };
    menu.addItem((item) => {
      item.setTitle(titleMap[dateType]);
      item.setDisabled(true);
    });

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const thisMonthStr = todayStr.slice(0, 7);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    const thisYearStart = `${now.getFullYear()}-01-01`;

    const presets = dateType === 'due'
      ? [
          { label: `今天到期 (${todayStr})`, value: todayStr },
          { label: '已逾期', value: `<${todayStr}` },
          { label: '本周内到期', value: `${todayStr}..${new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)}` },
          { label: `本月到期 (${thisMonthStr})`, value: thisMonthStr },
        ]
      : [
          { label: `今天 (${todayStr})`, value: todayStr },
          { label: `本月 (${thisMonthStr})`, value: thisMonthStr },
          { label: `上月 (${lastMonthStr})`, value: lastMonthStr },
          { label: `今年以来`, value: `>${thisYearStart}` },
          { label: '起止范围 (YYYY-MM-DD..YYYY-MM-DD)', value: `${thisYearStart}..${todayStr}` },
        ];
    presets.forEach(({ label, value: v }) => {
      menu.addItem((item) => {
        item.setTitle(label);
        item.onClick(() => { replaceLastWord(v); });
      });
    });
    showMenuSafe(menu);
  }

  // 显示 YAML 属性建议
  function showYamlSuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle('YAML 属性筛选');
      item.setDisabled(true);
    });
    menu.addItem((item) => {
      item.setTitle('输入格式: yaml:属性名:值');
      item.setDisabled(true);
    });

    const yamlKeys = availableYamlKeys.length > 0 ? availableYamlKeys : ['author', 'page', 'Color', 'Date', 'Annotation Type'];
    yamlKeys.slice(0, 20).forEach((key) => {
      menu.addItem((item) => {
        item.setTitle(`yaml:${key}:`);
        item.onClick(() => {
          replaceLastWord(`${key}:`);
        });
      });
    });
    showMenuSafe(menu);
  }

  // 显示标签建议
  function showTagSuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle('标签');
      item.setDisabled(true);
    });
    availableTags.slice(0, 20).forEach((tag) => {
      menu.addItem((item) => {
        item.setTitle(tag);
        item.onClick(() => {
          replaceLastWord(tag);
        });
      });
    });
    showMenuSafe(menu);
  }

  // 显示牌组建议
  function showDeckSuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle('牌组');
      item.setDisabled(true);
    });
    availableDecks.slice(0, 20).forEach((deck) => {
      menu.addItem((item) => {
        item.setTitle(deck.name);
        item.onClick(() => {
          replaceLastWord(`"${deck.name}"`);
        });
      });
    });
    showMenuSafe(menu);
  }

  // 显示优先级建议
  function showPrioritySuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle('优先级');
      item.setDisabled(true);
    });
    availablePriorities.forEach((priority) => {
      menu.addItem((item) => {
        item.setTitle(`${priority}`);
        item.onClick(() => {
          replaceLastWord(`${priority}`);
        });
      });
    });
    showMenuSafe(menu);
  }

  // 显示题型建议
  function showTypeSuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle('题型');
      item.setDisabled(true);
    });
    availableQuestionTypes.forEach((type) => {
      menu.addItem((item) => {
        item.setTitle(type);
        item.onClick(() => {
          replaceLastWord(type);
        });
      });
    });
    showMenuSafe(menu);
  }

  // 显示来源建议
  function showSourceSuggestions() {
    if (!containerRef || menuShown) return;
    const menu = new Menu();
    (menu as any).app = app;
    menu.addItem((item) => {
      item.setTitle('来源文档');
      item.setDisabled(true);
    });
    if (availableSources.length === 0) {
      menu.addItem((item) => {
        item.setTitle('暂无来源文档');
        item.setDisabled(true);
      });
    } else {
      availableSources.slice(0, 20).forEach((source) => {
        const fileName = source.split('/').pop() || source;
        menu.addItem((item) => {
          item.setTitle(fileName);
          item.onClick(() => {
            replaceLastWord(`"${source}"`);
          });
        });
      });
    }
    showMenuSafe(menu);
  }

  // 替换最后一个词
  function replaceLastWord(replacement: string) {
    if (!inputRef) return;
    
    const cursorPos = inputRef.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);
    
    const words = textBeforeCursor.split(/\s+/);
    words[words.length - 1] = words[words.length - 1].replace(/[^:]*$/, replacement);
    
    const joined = words.join(' ') + ' ';
    const trimmedAfter = textAfterCursor.trimStart();
    const newValue = joined + trimmedAfter;
    const newCursorPos = joined.length;
    
    value = newValue;
    
    setTimeout(() => {
      if (inputRef) {
        inputRef.focus();
        inputRef.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
    
    onSearch?.(value);
  }

  // 清除搜索
  function handleClear() {
    value = '';
    onClear?.();
    onSearch?.('');
    inputRef?.focus();
  }

  // 显示排序菜单（独立菜单，从排序图标触发）
  function showSortMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!containerRef || menuShown) return;
    
    const menu = new Menu();
    (menu as any).app = app;
    
    const sortFields = [
      { field: 'created', label: '创建时间' },
      { field: 'modified', label: '修改时间' },
      { field: 'front', label: '正面内容' },
      { field: 'back', label: '背面内容' },
      { field: 'deck', label: '牌组' },
      { field: 'tags', label: '标签' },
      { field: 'status', label: '状态' },
    ];
    
    sortFields.forEach(({ field, label }) => {
      menu.addItem((item) => {
        if (sortField === field) {
          item.setChecked(true);
          item.setTitle(sortDirection === 'asc' ? `${label} ↑` : `${label} ↓`);
        } else {
          item.setTitle(label);
        }
        item.onClick(() => {
          onSort?.(field);
        });
      });
    });
    
    showMenuSafe(menu);
  }
  
  // 插入前缀到搜索框
  function insertPrefix(prefix: string) {
    if (!inputRef) return;
    
    // 如果搜索框为空或以空格结尾，直接添加
    if (!value || value.endsWith(' ')) {
      value = value + prefix;
    } else {
      // 否则先加空格再添加
      value = value + ' ' + prefix;
    }
    
    // 聚焦并将光标移到末尾
    setTimeout(() => {
      if (inputRef) {
        inputRef.focus();
        inputRef.setSelectionRange(value.length, value.length);
      }
    }, 0);
    
    onSearch?.(value);
  }

  // 处理回车
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      addToHistory(value);
      showDropdown = false;
    } else if (e.key === 'Escape') {
      showDropdown = false;
      inputRef?.blur();
    } else if (e.key === ':') {
      // 输入冒号后延迟检查
      setTimeout(() => {
        checkAndShowSuggestions();
      }, 50);
    }
  }
</script>

<div class="card-search-container" bind:this={containerRef}>
  <div class="search-input-wrapper">
    <div class="search-icon">
      <EnhancedIcon name={ICON_NAMES.SEARCH} size={16} />
    </div>
    
    <input
      bind:this={inputRef}
      type="text"
      class="search-input"
      {placeholder}
      value={value}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onfocus={handleInputFocus}
    />
    
    {#if value && matchCount >= 0}
      <span class="match-count">{matchCount}{totalCount >= 0 ? `/${totalCount}` : ''}</span>
    {/if}

    {#if value}
      <div
        class="clear-button"
        role="button"
        tabindex="-1"
        onclick={handleClear}
        onkeydown={(e) => { if (e.key === 'Enter') handleClear(); }}
        aria-label="清除搜索"
      >
        <EnhancedIcon name={ICON_NAMES.TIMES} size={14} />
      </div>
    {/if}

    <div
      class="filter-button"
      role="button"
      tabindex="-1"
      onclick={showSortMenu}
      onkeydown={(e) => { if (e.key === 'Enter') showSortMenu(e as unknown as MouseEvent); }}
      aria-label="排序"
      title="排序选项"
    >
      <EnhancedIcon name={ICON_NAMES.SORT} size={14} />
    </div>
  </div>

  {#if showDropdown}
    <div class="search-dropdown">
      <div class="dropdown-section">
        <div class="dropdown-section-header">搜索选项</div>
        {#each dataSourceOptions as opt}
          <div
            class="dropdown-item"
            role="button"
            tabindex="-1"
            onmousedown={(e) => { e.preventDefault(); insertPrefix(opt.prefix); showDropdown = false; if (opt.afterInsert) setTimeout(opt.afterInsert, 100); }}
          >
            <span class="dropdown-item-label">{opt.label}</span>
          </div>
        {/each}
      </div>

      {#if searchHistory.length > 0}
        <div class="dropdown-divider"></div>
        <div class="dropdown-section">
          <div class="dropdown-section-header">搜索历史<span
              class="dropdown-clear-all"
              role="button"
              tabindex="-1"
              onmousedown={clearAllHistory}
            >清空</span></div>
          {#each searchHistory.slice(0, 10) as historyItem}
            <div
              class="dropdown-item"
              role="button"
              tabindex="-1"
              onmousedown={(e) => { e.preventDefault(); value = historyItem; onSearch?.(value); showDropdown = false; }}
            >
              <span class="dropdown-item-label">{historyItem}</span>
              <span
                class="dropdown-item-remove"
                role="button"
                tabindex="-1"
                onmousedown={(e) => { e.stopPropagation(); removeHistoryItem(historyItem, e); }}
                aria-label="删除"
              >
                <EnhancedIcon name={ICON_NAMES.TIMES} size={10} />
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .card-search-container {
    position: relative;
    width: 100%;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 0 8px;
    transition: all 0.2s ease;
  }

  .search-input-wrapper:focus-within {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
  }

  .search-icon {
    display: flex;
    align-items: center;
    color: var(--text-muted);
    margin-right: 8px;
  }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    padding: 8px 4px;
    font-size: 14px;
    color: var(--text-normal);
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-faint);
  }

  .match-count {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
    padding: 0 4px;
  }

  .clear-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .clear-button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .filter-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
    flex-shrink: 0;
    box-shadow: none;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .filter-button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .search-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    z-index: 100;
    max-height: 360px;
    overflow-y: auto;
    animation: dropdownFadeIn 0.15s ease;
  }

  @keyframes dropdownFadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .dropdown-section {
    padding: 4px 0;
  }

  .dropdown-section-header {
    padding: 6px 12px 4px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .dropdown-clear-all {
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--text-faint);
    cursor: pointer;
    text-transform: none;
    letter-spacing: normal;
  }

  .dropdown-clear-all:hover {
    color: var(--text-accent);
  }

  .dropdown-divider {
    height: 1px;
    background: var(--background-modifier-border);
    margin: 2px 8px;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 6px 12px;
    background: transparent;
    border: none;
    border-radius: 0;
    color: var(--text-normal);
    font-size: 0.8125rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s ease;
    gap: 8px;
    box-shadow: none;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .dropdown-item:hover {
    background: var(--background-modifier-hover);
  }

  .dropdown-item-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dropdown-item-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    border-radius: 3px;
    flex-shrink: 0;
    opacity: 0;
    transition: all 0.15s ease;
  }

  .dropdown-item:hover .dropdown-item-remove {
    opacity: 1;
  }

  .dropdown-item-remove:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
</style>
