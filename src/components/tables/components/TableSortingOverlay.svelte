<script lang="ts">
  interface Props {
    show: boolean;
  }

  let { show = false }: Props = $props();
</script>

{#if show}
  <div class="sorting-overlay" role="status" aria-label="正在排序">
    <div class="newtons-cradle">
      <div class="newtons-cradle__dot"></div>
      <div class="newtons-cradle__dot"></div>
      <div class="newtons-cradle__dot"></div>
      <div class="newtons-cradle__dot"></div>
    </div>
  </div>
{/if}

<style>
  .sorting-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--weave-z-overlay);
    pointer-events: all;
    cursor: wait;
    animation: fadeIn 0.15s ease;
    backdrop-filter: blur(2px);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* 牛顿摆动画 */
  .newtons-cradle {
    --uib-size: 60px;
    --uib-speed: 1.2s;
    --uib-color: #7c3aed;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--uib-size);
    height: var(--uib-size);
  }

  /* 深色模式适配 */
  :global(body.theme-dark) .newtons-cradle {
    --uib-color: #a78bfa;
  }

  .newtons-cradle__dot {
    position: relative;
    display: flex;
    align-items: center;
    height: 100%;
    width: 25%;
    transform-origin: center top;
  }

  .newtons-cradle__dot::after {
    content: '';
    display: block;
    width: 100%;
    height: 25%;
    border-radius: 50%;
    background-color: var(--uib-color);
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
  }

  .newtons-cradle__dot:first-child {
    animation: swing var(--uib-speed) linear infinite;
  }

  .newtons-cradle__dot:last-child {
    animation: swing2 var(--uib-speed) linear infinite;
  }

  @keyframes swing {
    0% {
      transform: rotate(0deg);
      animation-timing-function: ease-out;
    }
    25% {
      transform: rotate(70deg);
      animation-timing-function: ease-in;
    }
    50% {
      transform: rotate(0deg);
      animation-timing-function: linear;
    }
  }

  @keyframes swing2 {
    0% {
      transform: rotate(0deg);
      animation-timing-function: linear;
    }
    50% {
      transform: rotate(0deg);
      animation-timing-function: ease-out;
    }
    75% {
      transform: rotate(-70deg);
      animation-timing-function: ease-in;
    }
  }

  /* 无障碍：减少动画 */
  @media (prefers-reduced-motion: reduce) {
    .sorting-overlay {
      animation: none;
    }
    
    .newtons-cradle__dot {
      animation: none !important;
    }
    
    .newtons-cradle__dot::after {
      animation: pulse 1s ease infinite;
    }
    
    @keyframes pulse {
      0%, 100% {
        opacity: 0.5;
      }
      50% {
        opacity: 1;
      }
    }
  }
</style>






