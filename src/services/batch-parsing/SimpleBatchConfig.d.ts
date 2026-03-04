/**
 * 简化批量解析配置管理
 * 提供默认配置和配置验证
 *  重构后：使用统一的文件夹牌组映射
 */
import { UUIDConfig, SimpleBatchParsingConfig, FolderDeckMapping } from './index';
import { SimplifiedParsingSettings } from '../../types/newCardParsingTypes';
/**
 * 默认UUID配置
 * 注意：批量解析时自动启用UUID，避免重复导入
 * 🆕 批量扫描增强：使用空prefix，UUID格式为 <!-- tk-xxx --> ^blockid
 *
 * 格式示例：
 * ```
 * <->
 * 卡片内容...
 * <!-- tk-xxxxxxxxxxxx --> ^abc123
 * <->
 * ```
 */
export declare const DEFAULT_UUID_CONFIG: UUIDConfig;
/**
 * 🆕 创建默认批量解析配置（重构后）
 */
export declare function createDefaultBatchConfig(parsingSettings: SimplifiedParsingSettings): SimpleBatchParsingConfig;
/**
 * 配置验证器
 */
export declare class BatchConfigValidator {
    /**
     * 验证UUID配置
     */
    static validateUUIDConfig(config: UUIDConfig): {
        valid: boolean;
        errors: string[];
    };
    /**
     * 🆕 验证文件夹牌组映射
     */
    static validateFolderDeckMappings(mappings: FolderDeckMapping[]): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    };
    /**
     * 验证完整批量解析配置（ 重构后）
     */
    static validateBatchConfig(config: SimpleBatchParsingConfig): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    };
}
/**
 * 配置合并工具（ 重构后）
 */
export declare class BatchConfigMerger {
    /**
     * 合并配置（深度合并）
     */
    static merge(base: SimpleBatchParsingConfig, override: Partial<SimpleBatchParsingConfig>): SimpleBatchParsingConfig;
}
/**
 * 配置序列化工具
 */
export declare class BatchConfigSerializer {
    /**
     * 序列化配置为JSON
     */
    static serialize(config: SimpleBatchParsingConfig): string;
    /**
     * 从JSON反序列化配置
     */
    static deserialize(json: string): SimpleBatchParsingConfig | null;
    /**
     * 导出配置为文件内容
     */
    static exportToFile(config: SimpleBatchParsingConfig): string;
    /**
     * 从文件内容导入配置
     */
    static importFromFile(content: string): SimpleBatchParsingConfig | null;
}
