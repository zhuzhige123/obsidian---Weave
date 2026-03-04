/**
 * Card ID 验证工具
 * 防止虚拟ID被保存到数据库
 */

/**
 * 虚拟ID列表（系统内部使用的临时ID）
 */
const VIRTUAL_ID_PATTERNS = [
  'weave-study-session',      // 学习会话虚拟ID
  'weave-temp',               // 临时卡片ID
  'temp-',                     // 临时ID前缀
  'virtual-',                  // 虚拟ID前缀
];

/**
 * 验证卡片ID是否有效
 * @param id - 要验证的ID
 * @returns 是否有效
 */
export function isValidCardId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  // 检查是否是虚拟ID
  for (const pattern of VIRTUAL_ID_PATTERNS) {
    if (id.startsWith(pattern) || id.includes(pattern)) {
      return false;
    }
  }

  // 检查ID格式（应该是 card- 开头或其他有效格式）
  // 允许的格式：
  // - card-{timestamp}-{random}
  // - 其他自定义格式（向后兼容）
  return true;
}

/**
 * 验证UUID是否有效
 * @param uuid - 要验证的UUID
 * @returns 是否有效
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  // 检查是否是虚拟UUID
  if (uuid.startsWith('temp-uuid') || uuid.startsWith('virtual-uuid')) {
    return false;
  }

  // Weave UUID格式：tk-{12位字符}
  if (uuid.startsWith('tk-')) {
    return uuid.length >= 15 && /^tk-[a-z0-9]+$/.test(uuid);
  }

  // 标准UUID格式（向后兼容）
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * 验证卡片数据的完整性
 * @param card - 要验证的卡片
 * @returns 验证结果
 */
export function validateCard(card: { id: string; uuid: string }): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 验证ID (已迁移到UUID，暂时保留向后兼容)
  // if (!isValidCardId(card.id)) {
  //   errors.push(`无效的card.id: ${card.id}`);
  // }

  // 验证UUID
  if (!isValidUUID(card.uuid)) {
    errors.push(`无效的card.uuid: ${card.uuid}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 获取验证错误的详细信息
 * @param card - 卡片数据
 * @returns 错误信息
 */
export function getValidationErrorMessage(card: { id: string; uuid: string }): string {
  const result = validateCard(card);
  if (result.valid) {
    return '';
  }

  return `卡片数据验证失败:\n${result.errors.join('\n')}`;
}

/**
 * 检查ID是否是虚拟ID
 * @param id - 要检查的ID
 * @returns 是否是虚拟ID
 */
export function isVirtualId(id: string): boolean {
  return !isValidCardId(id);
}

/**
 * 安全获取卡片ID（如果是虚拟ID，抛出错误）
 * @param card - 卡片数据
 * @returns 有效的卡片ID
 */
export function getSafeCardId(card: { id: string; uuid: string }): string {
  if (isVirtualId(card.id)) {
    throw new Error(
      `检测到虚拟ID，不允许保存: ${card.id}\n` +
      `请使用真实的卡片ID。UUID: ${card.uuid}`
    );
  }
  return card.id;
}
