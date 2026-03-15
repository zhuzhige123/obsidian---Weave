import { ActivationErrorCode } from "../../../utils/types/license-types";

export const ACTIVATION_CODE_FORMAT = {
  MIN_LENGTH: 32,
  MAX_LENGTH: 2048,
  OPTIMAL_LENGTH_RANGE: [128, 1024] as const,
  EXPECTED_PARTS: 2,
  SEPARATOR: ".",
  BASE64_PATTERN: /^[A-Za-z0-9+/=]+$/,
  FULL_PATTERN: /^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/,
  WHITESPACE_PATTERN: /\s+/g,
  MIN_DATA_PART_LENGTH: 16,
  MIN_SIGNATURE_PART_LENGTH: 16,
} as const;

export const ACTIVATION_CODE_UI = {
  INPUT: {
    PLACEHOLDER: "请输入完整授权码",
    TEXTAREA_ROWS: 4,
    TEXTAREA_COLS: 60,
    MAX_LENGTH_ATTR: 2500,
    AUTO_TRIM: true,
    AUTO_RESIZE: true,
  },
  DISPLAY: {
    MAX_LENGTH: 64,
    TRUNCATE_SUFFIX: "...",
    PREVIEW_LENGTH: 20,
    MASKED_CHAR: "*",
    SHOW_LENGTH_HINT: true,
  },
  FEEDBACK: {
    SHOW_REAL_TIME: true,
    DEBOUNCE_MS: 300,
    SHOW_CHARACTER_COUNT: true,
    SHOW_FORMAT_HINTS: true,
  },
} as const;

export const ACTIVATION_CODE_VALIDATION = {
  REQUIRED_FIELDS: [
    "userId",
    "productId",
    "licenseType",
    "expiresAt",
    "maxDevices",
    "features",
    "issuedAt",
  ] as const,
  SUPPORTED_LICENSE_TYPES: ["lifetime", "subscription"] as const,
  SUPPORTED_PRODUCTS: ["weave-obsidian-plugin"] as const,
  TIME_VALIDATION: {
    MAX_FUTURE_DAYS: 365 * 10,
    MIN_ISSUE_AGE_MS: 0,
    MAX_ACTIVATION_DELAY_DAYS: 365 * 2,
  },
  DEVICE_LIMITS: {
    MIN_DEVICES: 1,
    MAX_DEVICES: 10,
    DEFAULT_DEVICES: 1,
  },
} as const;

export const ACTIVATION_ERROR_MESSAGES: Record<
  ActivationErrorCode,
  {
    title: string;
    message: string;
    details?: string;
    suggestedAction: string;
    recoverable: boolean;
  }
> = {
  [ActivationErrorCode.INVALID_FORMAT]: {
    title: "授权码格式错误",
    message: "授权码格式不正确，请检查输入内容。",
    suggestedAction: "请重新复制或粘贴完整授权码。",
    recoverable: true,
  },
  [ActivationErrorCode.INCOMPLETE_DATA]: {
    title: "授权数据不完整",
    message: "授权码中缺少必要信息。",
    suggestedAction: "请重新获取授权码。",
    recoverable: false,
  },
  [ActivationErrorCode.SIGNATURE_VERIFICATION_FAILED]: {
    title: "授权验证失败",
    message: "授权码签名验证失败。",
    suggestedAction: "请确认授权码来源可靠并重新尝试。",
    recoverable: false,
  },
  [ActivationErrorCode.EXPIRED_CODE]: {
    title: "授权已过期",
    message: "当前授权码已过期。",
    suggestedAction: "请获取新的授权码。",
    recoverable: false,
  },
  [ActivationErrorCode.PRODUCT_ID_MISMATCH]: {
    title: "产品不匹配",
    message: "授权码与当前产品不匹配。",
    suggestedAction: "请确认授权码适用于当前插件。",
    recoverable: false,
  },
  [ActivationErrorCode.DEVICE_FINGERPRINT_MISMATCH]: {
    title: "设备校验失败",
    message: "设备校验未通过。",
    suggestedAction: "如更换设备，请重新完成授权流程。",
    recoverable: false,
  },
  [ActivationErrorCode.ATTEMPT_LIMIT_EXCEEDED]: {
    title: "尝试次数过多",
    message: "当前操作过于频繁。",
    suggestedAction: "请稍后再试。",
    recoverable: true,
  },
  [ActivationErrorCode.CRYPTO_ERROR]: {
    title: "校验异常",
    message: "授权校验过程中出现异常。",
    suggestedAction: "请刷新后重试。",
    recoverable: true,
  },
  [ActivationErrorCode.STORAGE_ERROR]: {
    title: "存储失败",
    message: "无法保存授权状态。",
    suggestedAction: "请检查本地存储权限。",
    recoverable: true,
  },
  [ActivationErrorCode.UNKNOWN_ERROR]: {
    title: "未知错误",
    message: "授权过程中出现未知错误。",
    suggestedAction: "请稍后重试。",
    recoverable: true,
  },
  [ActivationErrorCode.MALFORMED_STRUCTURE]: {
    title: "授权结构异常",
    message: "授权码结构不符合要求。",
    suggestedAction: "请重新获取授权码。",
    recoverable: false,
  },
  [ActivationErrorCode.UNSUPPORTED_VERSION]: {
    title: "版本不支持",
    message: "授权码与当前插件版本不兼容。",
    suggestedAction: "请更新插件或重新获取授权。",
    recoverable: false,
  },
  [ActivationErrorCode.DEVICE_LIMIT_EXCEEDED]: {
    title: "设备数量超限",
    message: "已达到授权允许的设备数量上限。",
    suggestedAction: "请在其他设备解除授权后重试。",
    recoverable: false,
  },
  [ActivationErrorCode.RATE_LIMIT_EXCEEDED]: {
    title: "操作过于频繁",
    message: "请稍后再次尝试。",
    suggestedAction: "等待一段时间后重试。",
    recoverable: true,
  },
  [ActivationErrorCode.NETWORK_ERROR]: {
    title: "网络错误",
    message: "网络连接异常。",
    suggestedAction: "请检查网络连接后重试。",
    recoverable: true,
  },
};

export const ACTIVATION_SUCCESS_MESSAGES = {
  ACTIVATION_SUCCESS: {
    title: "授权成功",
    message: "授权状态已更新。",
    duration: 5000,
  },
  REACTIVATION_SUCCESS: {
    title: "重新授权成功",
    message: "授权状态已刷新。",
    duration: 5000,
  },
  LICENSE_RENEWED: {
    title: "授权已续期",
    message: "授权有效期已更新。",
    duration: 5000,
  },
} as const;

export const ACTIVATION_WARNING_MESSAGES = {
  EXPIRY_WARNING: (days: number) => ({
    title: "授权即将到期",
    message: `授权将在 ${days} 天后到期。`,
    suggestedAction: "请提前完成续期。",
  }),
  DEVICE_CHANGE_WARNING: {
    title: "检测到设备环境变化",
    message: "当前设备环境与上次授权时不同。",
    suggestedAction: "如为预期变更，可忽略该提示。",
  },
  VERSION_MISMATCH_WARNING: (licenseVersion: string, currentVersion: string) => ({
    title: "版本不匹配",
    message: `授权版本 ${licenseVersion} 与当前版本 ${currentVersion} 不一致。`,
    suggestedAction: "建议使用兼容版本。",
  }),
} as const;

export const ACTIVATION_HELP_TEXT = {
  FORMAT_HELP: "授权码通常由两段字符串组成，中间用点号分隔。",
  INPUT_TIPS: [
    "请完整粘贴授权码。",
    "授权码区分大小写。",
    "如长度较长，建议使用粘贴方式输入。",
  ],
  TROUBLESHOOTING: [
    "如果提示格式错误，请检查是否复制完整。",
    "如果提示过期，请重新获取授权。",
    "如果提示设备不匹配，请重新完成授权流程。",
  ],
  CONTACT_INFO: {
    email: "support@example.com",
    subject: "Weave 授权支持",
    github: "https://github.com/zhuzhige123/obsidian---Weave",
    purchase: "",
  },
} as const;

export function getActivationErrorMessage(code: ActivationErrorCode) {
  return ACTIVATION_ERROR_MESSAGES[code] ?? ACTIVATION_ERROR_MESSAGES[ActivationErrorCode.UNKNOWN_ERROR];
}

export function isActivationCodeLengthValid(code: string): boolean {
  const length = code.trim().length;
  return length >= ACTIVATION_CODE_FORMAT.MIN_LENGTH && length <= ACTIVATION_CODE_FORMAT.MAX_LENGTH;
}

export function isActivationCodeFormatValid(code: string): boolean {
  return ACTIVATION_CODE_FORMAT.FULL_PATTERN.test(code.trim());
}

export function cleanActivationCodeInput(input: string): string {
  return input.replace(ACTIVATION_CODE_FORMAT.WHITESPACE_PATTERN, "").trim();
}
