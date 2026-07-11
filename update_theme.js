const fs = require('fs');
const path = require('path');

const files = [
  'src/components/Starfield.tsx',
  'src/components/LoginOverlay.tsx',
  'src/components/BottomNav.tsx',
  'src/app/globals.css',
  'src/components/GarbageMap.tsx',
  'src/app/page.tsx',
  'src/app/report/page.tsx',
  'src/app/profile/page.tsx',
  'src/app/leaderboard/page.tsx',
  'src/app/feed/page.tsx'
];

files.forEach(file => {
  const absolutePath = path.join(process.cwd(), file);
  if (fs.existsSync(absolutePath)) {
    let content = fs.readFileSync(absolutePath, 'utf8');
    content = content.replace(/#20c997/gi, '#65a30d');
    content = content.replace(/32,201,151/gi, '101,163,13');
    content = content.replace(/32, 201, 151/gi, '101, 163, 13');
    fs.writeFileSync(absolutePath, content, 'utf8');
    console.log('Updated', file);
  } else {
    console.warn('File not found', file);
  }
});
console.log('Done!');
