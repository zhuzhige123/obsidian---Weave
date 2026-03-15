import { App, TFile } from 'obsidian';
import type { ParsedCard, SingleCardConfig } from '../../types/newCardParsingTypes';
export interface SingleCardParseResult {
    success: boolean;
    card?: ParsedCard;
    error?: string;
    shouldSkip?: boolean;
    skipReason?: string;
}
export declare class SingleCardParser {
    private app;
    private frontmatterManager;
    constructor(app: App);
    parseFile(file: TFile, config: SingleCardConfig, targetDeckId: string): Promise<SingleCardParseResult>;
    private splitFrontBack;
    private extractTags;
    private shouldSkipByTags;
    parseFiles(files: TFile[], config: SingleCardConfig, targetDeckId: string): Promise<SingleCardParseResult[]>;
    getFileUUID(file: TFile): Promise<string | null>;
    setFileUUID(file: TFile, uuid: string): Promise<void>;
}
