<script lang="ts">
  /**
   * 翻页时钟组件
   * 用于考试倒计时，具有真实的翻页动画效果
   */

  interface Props {
    remainingTime: number;
    isPaused?: boolean;
    isTimeWarning?: boolean;
  }

  let { remainingTime, isPaused = false, isTimeWarning = false }: Props = $props();

  // 计算当前显示的数字
  const digits = $derived(() => {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    
    return {
      minTens: Math.floor(minutes / 10),
      minOnes: minutes % 10,
      secTens: Math.floor(seconds / 10),
      secOnes: seconds % 10
    };
  });

  // 触发翻页动画的函数
  function triggerFlip(element: HTMLElement) {
    // 移除旧的动画类
    element.querySelectorAll('.flip-top, .flip-bottom').forEach(el => el.remove());
    
    const digitCard = element.querySelector('.digit-card');
    if (!digitCard) return;

    // 获取旧值和新值
    const currentDigit = digitCard.querySelector('.digit-current');
    if (!currentDigit) return;
    
    const oldValue = currentDigit.getAttribute('data-old-value') || currentDigit.textContent;
    const newValue = currentDigit.textContent;
    
    if (oldValue === newValue) return;

    // 创建翻页动画元素
    const flipTop = document.createElement('div');
    flipTop.className = 'flip-top flipping';
    flipTop.innerHTML = `<div class="flip-content">${oldValue}</div>`;

    const flipBottom = document.createElement('div');
    flipBottom.className = 'flip-bottom flipping';
    flipBottom.innerHTML = `<div class="flip-content">${newValue}</div>`;

    digitCard.appendChild(flipTop);
    digitCard.appendChild(flipBottom);

    // 动画完成后清理
    setTimeout(() => {
      flipTop.remove();
      flipBottom.remove();
      currentDigit.setAttribute('data-old-value', newValue || '0');
    }, 650);
  }

  // 存储上一次的数字值（使用普通变量，不触发响应式）
  let prevDigits = { minTens: -1, minOnes: -1, secTens: -1, secOnes: -1 };
  let isFirstRender = true;

  // 监听数字变化并触发动画
  $effect(() => {
    const d = digits();
    
    // 首次渲染时只初始化，不触发动画
    if (isFirstRender) {
      prevDigits = { ...d };
      isFirstRender = false;
      return;
    }
    
    const elements = {
      minTens: document.getElementById('flip-min-tens'),
      minOnes: document.getElementById('flip-min-ones'),
      secTens: document.getElementById('flip-sec-tens'),
      secOnes: document.getElementById('flip-sec-ones')
    };

    // 检查每个数字是否变化
    (Object.keys(d) as Array<keyof typeof d>).forEach((key) => {
      const newValue = d[key];
      const oldValue = prevDigits[key];
      
      if (newValue !== oldValue) {
        const element = elements[key];
        if (element) {
          const currentDigit = element.querySelector('.digit-current');
          if (currentDigit && currentDigit.textContent !== String(newValue)) {
            currentDigit.setAttribute('data-old-value', String(oldValue));
            currentDigit.textContent = String(newValue);
            triggerFlip(element);
          }
        }
      }
    });

    // 更新上一次的值
    prevDigits = { ...d };
  });
</script>

<div class="flip-clock" class:warning={isTimeWarning} class:paused={isPaused}>
  <!-- 分钟 -->
  <div class="flip-digit" id="flip-min-tens">
    <div class="digit-card">
      <div class="digit-current" data-old-value="0">{digits().minTens}</div>
    </div>
  </div>
  <div class="flip-digit" id="flip-min-ones">
    <div class="digit-card">
      <div class="digit-current" data-old-value="5">{digits().minOnes}</div>
    </div>
  </div>

  <!-- 分隔符 -->
  <div class="separator">:</div>

  <!-- 秒 -->
  <div class="flip-digit" id="flip-sec-tens">
    <div class="digit-card">
      <div class="digit-current" data-old-value="0">{digits().secTens}</div>
    </div>
  </div>
  <div class="flip-digit" id="flip-sec-ones">
    <div class="digit-card">
      <div class="digit-current" data-old-value="0">{digits().secOnes}</div>
    </div>
  </div>
</div>

<style>
  .flip-clock {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: #1a1a1a;
    border-radius: 8px;
    border: 2px solid #2a2a2a;
    box-shadow: 
      inset 0 2px 8px rgba(0, 0, 0, 0.8),
      0 2px 12px rgba(0, 0, 0, 0.4);
  }

  /* 单个翻页数字 */
  .flip-digit {
    position: relative;
    width: 36px;
    height: 52px;
    perspective: 1000px;
  }

  .digit-card {
    position: relative;
    width: 100%;
    height: 100%;
    background: linear-gradient(180deg, #2a2a3e 0%, #1f1f2e 100%);
    border-radius: 6px;
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.5),
      inset 0 2px 4px rgba(255, 255, 255, 0.05);
    overflow: hidden;
  }

  /* 完整数字显示 */
  .digit-current {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    font-weight: 900;
    color: #e0e0e0;
    line-height: 1;
    z-index: 1;
    font-family: 'Arial Black', sans-serif;
  }

  /* 中间分割线 */
  .digit-card::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: rgba(0, 0, 0, 0.4);
    z-index: 3;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  /* 上半部遮罩效果 */
  .digit-card::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
    z-index: 2;
    pointer-events: none;
  }

  /* 翻页动画容器 - 上半部分（动态生成，使用 :global()） */
  :global(.flip-top) {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
    overflow: hidden;
    transform-origin: bottom;
    backface-visibility: hidden;
    z-index: 4;
  }

  :global(.flip-top .flip-content) {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 200%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    font-weight: 900;
    color: #e0e0e0;
    background: linear-gradient(180deg, #3a3a4e 0%, #2a2a3e 100%);
    font-family: 'Arial Black', sans-serif;
  }

  /* 翻页动画容器 - 下半部分（动态生成，使用 :global()） */
  :global(.flip-bottom) {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 50%;
    overflow: hidden;
    transform-origin: top;
    backface-visibility: hidden;
    z-index: 4;
  }

  :global(.flip-bottom .flip-content) {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 200%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    font-weight: 900;
    color: #e0e0e0;
    background: linear-gradient(180deg, #2a2a3e 0%, #1a1a2e 100%);
    font-family: 'Arial Black', sans-serif;
  }

  /* 翻页动画 */
  :global(.flip-top.flipping) {
    animation: flipDown 0.6s ease-in;
  }

  :global(.flip-bottom.flipping) {
    animation: flipUp 0.6s ease-out;
  }

  @keyframes flipDown {
    0% {
      transform: rotateX(0deg);
    }
    100% {
      transform: rotateX(-180deg);
    }
  }

  @keyframes flipUp {
    0% {
      transform: rotateX(180deg);
    }
    100% {
      transform: rotateX(0deg);
    }
  }

  /* 翻页时添加阴影效果 */
  :global(.flip-top.flipping) {
    box-shadow: 0 -5px 15px rgba(0, 0, 0, 0.5);
  }

  :global(.flip-bottom.flipping) {
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
  }

  /* 分隔符 */
  .separator {
    font-size: 32px;
    font-weight: 900;
    color: #e0e0e0;
    opacity: 0.6;
    margin: 0 4px;
    animation: blink 1s ease-in-out infinite;
    font-family: 'Arial Black', sans-serif;
  }

  @keyframes blink {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 0.2; }
  }

  /* 警告模式 */
  .flip-clock.warning {
    background: #2a1a0a;
    border-color: #78350f;
    box-shadow: 
      inset 0 2px 8px rgba(180, 83, 9, 0.4),
      0 2px 12px rgba(245, 158, 11, 0.3);
  }

  .flip-clock.warning .digit-card {
    background: linear-gradient(180deg, #4a2a2e 0%, #3a1a1e 100%);
  }

  .flip-clock.warning .digit-current {
    color: #ff6b6b;
  }

  .flip-clock.warning :global(.flip-content) {
    color: #ff6b6b;
  }

  .flip-clock.warning .separator {
    color: #ff6b6b;
  }

  /* 暂停模式 */
  .flip-clock.paused {
    opacity: 0.7;
  }

  .flip-clock.paused .digit-card {
    background: linear-gradient(180deg, #3f3f46 0%, #27272a 100%);
  }

  .flip-clock.paused .digit-current {
    color: #d4d4d8;
  }
</style>
