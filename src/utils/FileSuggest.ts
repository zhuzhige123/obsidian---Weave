/**
 * 文件建议器
 * 使用Obsidian原生API提供Markdown文件选择功能
 */

import { AbstractInputSuggest, App, TFile } from 'obsidian';

export class FileSuggest extends AbstractInputSuggest<TFile> {
  private inputElement: HTMLInputElement;

  constructor(
    app: App,
    inputEl: HTMLInputElement
  ) {
    super(app, inputEl);
    this.inputElement = inputEl;
  }

  getSuggestions(inputStr: string): TFile[] {
    const abstractFiles = this.app.vault.getAllLoadedFiles();
    const files: TFile[] = [];
    const lowerCaseInputStr = inputStr.toLowerCase();

    abstractFiles.forEach((file) => {
      if (
        file instanceof TFile &&
        file.extension === 'md' &&
        file.path.toLowerCase().contains(lowerCaseInputStr)
      ) {
        files.push(file);
      }
    });

    return files;
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFile): void {
    if (this.inputElement) {
      this.inputElement.value = file.path;
      this.inputElement.trigger('input');
    }
    this.close();
  }
}



