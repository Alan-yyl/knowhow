const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// 要检查的文件列表
const files = [
  '纳瓦尔宝典-笔记.html',
  '纳瓦尔宝典-笔记2.html',
  '纳瓦尔宝典-笔记3.html',
  '纳瓦尔宝典-笔记4.html'
];

// 检查每个文件中的链接
files.forEach(file => {
  console.log(`\n检查文件: ${file}`);
  
  try {
    const content = fs.readFileSync(file, 'utf8');
    const dom = new JSDOM(content);
    const links = dom.window.document.querySelectorAll('.pagination a');
    
    console.log(`发现 ${links.length} 个分页链接:`);
    
    links.forEach(link => {
      const href = link.getAttribute('href');
      const text = link.textContent.trim();
      
      console.log(`  - 链接: ${href}, 文本: "${text}"`);
      
      // 检查链接文件是否存在
      if (fs.existsSync(href)) {
        console.log(`    ✓ 目标文件存在`);
      } else {
        console.log(`    ✗ 错误: 目标文件不存在!`);
      }
    });
    
  } catch (err) {
    console.error(`  无法解析文件: ${err.message}`);
  }
}); 