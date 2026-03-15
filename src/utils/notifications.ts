export function showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
  const n = document.createElement('div');
  n.className = `weave-notification notification-${type}`;

  // 获取主题相关的颜色
  const getThemeColors = () => {
    const isDark = document.body.classList.contains('theme-dark') ||
                   document.documentElement.classList.contains('theme-dark') ||
                   window.matchMedia('(prefers-color-scheme: dark)').matches;

    const colors = {
      success: isDark ? '#10b981' : '#059669',
      error: isDark ? '#ef4444' : '#dc2626',
      warning: isDark ? '#f59e0b' : '#d97706',
      info: isDark ? '#3b82f6' : '#2563eb'
    };

    return colors[type] || colors.info;
  };

  n.style.background = getThemeColors();

  // 添加图标
  const icon = document.createElement('span');
  icon.className = 'weave-notification-icon';

  const iconMap = {
    success: '\u2713',
    error: '\u2715',
    warning: '\u26A0',
    info: '\u2139'
  };

  icon.textContent = iconMap[type] || iconMap.info;
  n.appendChild(icon);

  // 添加消息文本
  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  textSpan.className = 'weave-flex-1';
  n.appendChild(textSpan);

  document.body.appendChild(n);

  // 样式已迁移到 styles/dynamic-injected.css

  // 动画进入
  setTimeout(() => {
    n.style.transform = 'translateX(0)';
  }, 10);

  // 自动消失
  setTimeout(() => {
    n.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (n.parentNode) {
        n.remove();
      }
    }, 300);
  }, 3000);
}
