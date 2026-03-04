<!--
  Obsidian 原生图标组件
  封装 Obsidian 的图标系统供 Svelte 组件使用
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { setIcon } from 'obsidian';

  let {
    name,
    size = 16,
    class: className = ''
  }: {
    name: string;
    size?: number;
    class?: string;
  } = $props();

  let iconElement: HTMLSpanElement;

  onMount(() => {
    if (iconElement) {
      setIcon(iconElement, name);
      // 确保 SVG 尺寸正确
      const svg = iconElement.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
        svg.style.width = `${size}px`;
        svg.style.height = `${size}px`;
      }
    }
  });

  // 当图标名称或尺寸变化时更新图标
  $effect(() => {
    if (iconElement && name) {
      setIcon(iconElement, name);
      // 确保 SVG 尺寸正确
      const svg = iconElement.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
        svg.style.width = `${size}px`;
        svg.style.height = `${size}px`;
      }
    }
  });
</script>

<span
  bind:this={iconElement}
  class="obsidian-icon {className}"
  style="width: {size}px; height: {size}px; min-width: {size}px; min-height: {size}px; display: inline-flex; align-items: center; justify-content: center;"
  role="img"
  aria-label={name}
></span>

<style>
  .obsidian-icon {
    vertical-align: middle;
    line-height: 1;
    flex-shrink: 0;
  }

  .obsidian-icon :global(svg) {
    width: 100% !important;
    height: 100% !important;
    vertical-align: top;
    flex-shrink: 0;
  }
</style>


