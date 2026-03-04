/**
 * FSRS数据展示工具函数
 * 用于格式化和美化FSRS相关数据的显示
 */

/**
 * 格式化下次复习时间
 * @param date 下次复习的日期
 * @returns 格式化的字符串
 */
export function formatNextReview(date: Date | null): string {
  if (!date) return '-';
  
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days < 0) return '已到期';
  if (days === 0) return '今天';
  if (days === 1) return '明天';
  if (days < 7) return `${days}天后`;
  if (days < 30) return `${Math.floor(days / 7)}周后`;
  return `${Math.floor(days / 30)}月后`;
}

/**
 * 获取下次复习时间的颜色
 * @param date 下次复习的日期
 * @returns CSS颜色变量
 */
export function getNextReviewColor(date: Date | null): string {
  if (!date) return 'var(--text-muted)';
  
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days < 0) return 'var(--text-error)';
  if (days === 0) return 'var(--text-warning)';
  if (days < 7) return 'var(--text-accent)';
  return 'var(--text-muted)';
}

/**
 * 获取记忆率颜色
 * @param retention 记忆率 (0-1)
 * @returns CSS颜色变量
 */
export function getRetentionColor(retention: number): string {
  if (retention >= 0.9) return 'var(--color-green)';
  if (retention >= 0.8) return 'var(--color-cyan)';
  if (retention >= 0.7) return 'var(--color-yellow)';
  return 'var(--color-red)';
}

/**
 * 格式化间隔时间
 * @param days 天数
 * @returns 格式化的字符串
 */
export function formatInterval(days: number): string {
  if (days < 1) return '< 1天';
  if (days < 30) return `${days}天`;
  if (days < 365) return `${Math.floor(days / 30)}个月`;
  return `${(days / 365).toFixed(1)}年`;
}

/**
 * 获取难度颜色
 * @param difficulty 难度系数 (1-10)
 * @returns CSS颜色变量
 */
export function getDifficultyColor(difficulty: number): string {
  if (difficulty <= 3) return 'var(--color-green)';
  if (difficulty <= 5) return 'var(--color-yellow)';
  if (difficulty <= 7) return 'var(--color-orange)';
  return 'var(--color-red)';
}

