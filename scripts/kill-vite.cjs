/**
 * 构建前清理脚本
 * 1. 清理dist目录（解决emptyOutDir卡住的问题）
 * 2. 清理vite缓存
 */
const fs = require('fs');
const path = require('path');

// 清理dist目录
function cleanDistDir() {
  const distDir = path.join(__dirname, '..', 'dist');
  
  if (fs.existsSync(distDir)) {
    try {
      // 只删除构建产物，保留用户可能放置的其他文件
      const buildFiles = ['main.js', 'styles.css', 'manifest.json', 'sql-wasm.wasm', 'README.md', 'versions.json'];
      
      for (const file of buildFiles) {
        const filePath = path.join(distDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      console.log('🧹 已清理dist目录中的构建产物');
    } catch (e) {
      console.log('⚠️ 清理dist目录时出错:', e.message);
    }
  } else {
    fs.mkdirSync(distDir, { recursive: true });
    console.log('📁 已创建dist目录');
  }
}

// 清理vite缓存
function cleanViteCache() {
  const cacheDir = path.join(__dirname, '..', 'node_modules', '.vite');
  
  if (fs.existsSync(cacheDir)) {
    try {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      console.log('🧹 已清理vite缓存');
    } catch (e) {
      // 忽略，缓存清理失败不影响构建
    }
  }
}

cleanDistDir();
cleanViteCache();
console.log('✅ 构建前清理完成');
