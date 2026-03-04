/**
 * 文件夹建议器
 * 使用Obsidian原生API提供文件夹选择功能
 */

import { AbstractInputSuggest, App, TFolder, TAbstractFile } from 'obsidian';

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  private inputElement: HTMLInputElement;

  constructor(
    app: App,
    inputEl: HTMLInputElement
  ) {
    super(app, inputEl);
    this.inputElement = inputEl;
  }

  getSuggestions(inputStr: string): TFolder[] {
    const abstractFiles = this.app.vault.getAllLoadedFiles();
    const folders: TFolder[] = [];
    const lowerCaseInputStr = inputStr.toLowerCase();

    abstractFiles.forEach((file: TAbstractFile) => {
      if (
        file instanceof TFolder &&
        file.path.toLowerCase().contains(lowerCaseInputStr)
      ) {
        folders.push(file);
      }
    });

    return folders;
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  selectSuggestion(folder: TFolder): void {
    if (this.inputElement) {
      this.inputElement.value = folder.path;
      this.inputElement.trigger('input');
    }
    this.close();
  }
}

