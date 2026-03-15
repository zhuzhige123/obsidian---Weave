import { logger } from "../utils/logger";

export interface SecurityConfig {
  readonly encryption: {
    rsaPublicKey: string;
    keyVersion: string;
    algorithm: "RSASSA-PKCS1-v1_5";
    hashAlgorithm: "SHA-256";
  };
  readonly product: {
    id: string;
    version: string;
    compatibleVersions: string[];
  };
  readonly validation: {
    fingerprintSimilarityThreshold: number;
    deviceChangeWarningThreshold: number;
    expiryWarningDays: number;
    maxActivationAttempts: number;
    lockoutDurationMs: number;
    attemptWindowMs: number;
  };
  readonly fingerprint: {
    version: string;
    componentWeights: Record<string, number>;
    enabledComponents: string[];
  };
}

// Public-safe defaults used by the open repo. These keep the interface stable
// without exposing any private rollout or deployment details.
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  encryption: {
    rsaPublicKey: "PUBLIC_KEY_MANAGED_OUTSIDE_OPEN_REPO",
    keyVersion: "public",
    algorithm: "RSASSA-PKCS1-v1_5",
    hashAlgorithm: "SHA-256",
  },
  product: {
    id: "weave-obsidian-plugin",
    version: "public",
    compatibleVersions: ["public"],
  },
  validation: {
    fingerprintSimilarityThreshold: 0.7,
    deviceChangeWarningThreshold: 0.9,
    expiryWarningDays: 30,
    maxActivationAttempts: 5,
    lockoutDurationMs: 15 * 60 * 1000,
    attemptWindowMs: 5 * 60 * 1000,
  },
  fingerprint: {
    version: "public",
    componentWeights: {
      userAgent: 0.2,
      screen: 0.15,
      timezone: 0.1,
      language: 0.1,
      hardware: 0.15,
      obsidian: 0.2,
      canvas: 0.05,
      webgl: 0.05,
    },
    enabledComponents: [
      "userAgent",
      "screen",
      "timezone",
      "language",
      "hardware",
      "obsidian",
      "canvas",
      "webgl",
    ],
  },
};

export class SecurityConfigLoader {
  private static instance: SecurityConfigLoader;
  private config: SecurityConfig | null = null;

  private constructor() {}

  static getInstance(): SecurityConfigLoader {
    if (!SecurityConfigLoader.instance) {
      SecurityConfigLoader.instance = new SecurityConfigLoader();
    }
    return SecurityConfigLoader.instance;
  }

  async loadConfig(): Promise<SecurityConfig> {
    if (this.config) {
      return this.config;
    }

    this.config = DEFAULT_SECURITY_CONFIG;
    return this.config;
  }

  validateConfig(config: SecurityConfig): boolean {
    try {
      return Boolean(
        config.encryption.rsaPublicKey &&
          config.product.id &&
          config.product.version
      );
    } catch (error) {
      logger.error("Security config validation failed:", error);
      return false;
    }
  }

  async reloadConfig(): Promise<SecurityConfig> {
    this.config = null;
    return this.loadConfig();
  }
}

export async function getSecurityConfig(): Promise<SecurityConfig> {
  return SecurityConfigLoader.getInstance().loadConfig();
}

export function validateSecurityConfig(config: SecurityConfig): boolean {
  return SecurityConfigLoader.getInstance().validateConfig(config);
}
