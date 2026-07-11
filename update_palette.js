const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir(srcDir, function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.css') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Accent color replacement
    content = content.replace(/#65a30d/gi, '#455d49');
    content = content.replace(/101,163,13/g, '69,93,73');
    content = content.replace(/101, 163, 13/g, '69, 93, 73');
    
    // 2. Panel backgrounds (replace dark greys with the middle green)
    content = content.replace(/rgba\(20,20,20,0\.85\)/g, 'rgba(21,57,57,0.85)');
    content = content.replace(/rgba\(20, 20, 20, 0\.85\)/g, 'rgba(21, 57, 57, 0.85)');
    content = content.replace(/rgba\(40,40,40,0\.9\)/g, 'rgba(21,57,57,0.9)');
    content = content.replace(/rgba\(10,10,10,0\.95\)/g, 'rgba(13,27,10,0.95)'); // Uses darkest for map overlay

    // 3. App background (replace black with darkest green)
    // Be careful with bg-black, only replace where it means background
    content = content.replace(/bg-black/g, 'bg-[#0d1b0a]');
    content = content.replace(/bg-\[#000000\]/g, 'bg-[#0d1b0a]');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  }
});
console.log('Palette update complete!');
