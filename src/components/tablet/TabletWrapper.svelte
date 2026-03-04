<!--
  平板端适配包装器组件
  自动检测设备类型并应用相应的样式和行为
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { detectDevice, applyDeviceClasses, onOrientationChange, type DeviceInfo } from '../../utils/tablet-detection';

  interface Props {
    /** 子内容 */
    children?: any;
    /** 是否启用自动设备检测 */
    autoDetect?: boolean;
    /** 是否应用设备类名 */
    applyClasses?: boolean;
    /** 自定义容器类名 */
    class?: string;
  }

  let {
    children,
    autoDetect = true,
    applyClasses = true,
    class: customClass = ''
  }: Props = $props();

  // 设备信息状态
  let deviceInfo = $state<DeviceInfo | null>(null);
  let orientationCleanup: (() => void) | null = null;
  let containerElement: HTMLDivElement;

  // 响应式类名
  const containerClass = $derived.by(() => {
    const classes = ['weave-tablet-wrapper'];
    
    if (customClass) classes.push(customClass);
    
    if (deviceInfo) {
      if (deviceInfo.isTablet) classes.push('is-tablet');
      if (deviceInfo.isMobile) classes.push('is-mobile');
      if (deviceInfo.isDesktop) classes.push('is-desktop');
      if (deviceInfo.isTouch) classes.push('is-touch');
      classes.push(`is-${deviceInfo.orientation}`);
      classes.push(`is-${deviceInfo.screenSize}`);
    }
    
    return classes.join(' ');
  });

  // 组件挂载时初始化
  onMount(() => {
    if (autoDetect) {
      // 检测设备信息
      deviceInfo = detectDevice();
      
      // 应用设备类名到容器
      if (applyClasses && containerElement) {
        applyDeviceClasses(containerElement);
      }
      
      // 监听方向变化
      orientationCleanup = onOrientationChange((orientation) => {
        if (deviceInfo) {
          deviceInfo = { ...deviceInfo, orientation };
          
          // 重新应用类名
          if (applyClasses && containerElement) {
            applyDeviceClasses(containerElement);
          }
        }
      });
    }
  });

  // 组件销毁时清理
  onDestroy(() => {
    if (orientationCleanup) {
      orientationCleanup();
    }
  });

  // 暴露设备信息给父组件
  export function getDeviceInfo(): DeviceInfo | null {
    return deviceInfo;
  }

  // 手动刷新设备检测
  export function refreshDeviceInfo(): void {
    deviceInfo = detectDevice();
    if (applyClasses && containerElement) {
      applyDeviceClasses(containerElement);
    }
  }
</script>

<div 
  bind:this={containerElement}
  class={containerClass}
  data-device-type={deviceInfo?.isTablet ? 'tablet' : deviceInfo?.isMobile ? 'mobile' : 'desktop'}
  data-orientation={deviceInfo?.orientation}
  data-screen-size={deviceInfo?.screenSize}
>
  {@render children?.()}
</div>

<style>
  .weave-tablet-wrapper {
    /* 基础容器样式 */
    position: relative;
    width: 100%;
    height: 100%;
  }

  /* 平板端特定样式 */
  .weave-tablet-wrapper.is-tablet {
    /* 平板端容器适配 */
    --weave-container-max-width: 100%;
    --weave-container-padding: var(--size-4-4, 16px);
  }

  /* 触控设备样式 */
  .weave-tablet-wrapper.is-touch {
    /* 触控优化 */
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  /* 横屏模式 */
  .weave-tablet-wrapper.is-landscape {
    /* 横屏特定布局 */
    --weave-layout-direction: row;
    --weave-sidebar-width: 300px;
  }

  /* 竖屏模式 */
  .weave-tablet-wrapper.is-portrait {
    /* 竖屏特定布局 */
    --weave-layout-direction: column;
    --weave-sidebar-width: 100%;
  }

  /* 中等屏幕尺寸 */
  .weave-tablet-wrapper.is-medium {
    /* 中等屏幕的容器限制 */
    max-width: 1024px;
    margin: 0 auto;
  }

  /* 动画优化 */
  .weave-tablet-wrapper {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* 减少动画模式 */
  @media (prefers-reduced-motion: reduce) {
    .weave-tablet-wrapper {
      transition: none;
    }
  }
</style>
