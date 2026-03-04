/**
 * 清理 Vite 和 Node 缓存
 * 用于解决热重载问题
 */

const fs = require('fs');
const path = require('path');

const cacheDirectories = [
  'node_modules/.vite',
  'node_modules/.cache',
  '.svelte-kit',
  'dist'
];

console.log('🧹 开始清理缓存...\n');

cacheDirectories.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`✅ 已删除: ${dir}`);
    } catch (error) {
      console.error(`❌ 删除失败: ${dir}`, error.message);
    }
  } else {
    console.log(`⏭️  不存在: ${dir}`);
  }
});

console.log('\n✨ 缓存清理完成！');
console.log('💡 提示: 现在可以重新运行 npm run dev');







