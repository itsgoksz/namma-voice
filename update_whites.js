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
  if (filePath.endsWith('.tsx') || filePath.endsWith('.css')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace alpha borders with the lightest green
    content = content.replace(/border-white\/(5|10|20|30)/g, 'border-[#455d49]');
    
    // Replace alpha backgrounds with the lightest green with some opacity
    content = content.replace(/bg-white\/(5|10)/g, 'bg-[#455d49]/30');
    content = content.replace(/bg-white\/(20|30)/g, 'bg-[#455d49]/60');
    
    // Replace alpha text with the lightest green
    content = content.replace(/text-white\/(30|50|70)/g, 'text-[#455d49]');
    
    // Replace text-text-secondary with the lightest green
    content = content.replace(/text-text-secondary/g, 'text-[#455d49]');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  }
});
console.log('Whites updated!');
