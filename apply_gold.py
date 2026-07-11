import os
import re

dirs = ['src/']
files_to_update = []
for d in dirs:
    for root, _, files in os.walk(d):
        for f in files:
            if f.endswith('.tsx') or f.endswith('.ts') or f.endswith('.css'):
                files_to_update.append(os.path.join(root, f))

for filepath in files_to_update:
    with open(filepath, 'r') as f:
        content = f.read()
    
    # 1. Replace text
    content = content.replace('🌱 Points', 'Eco XP')
    content = content.replace('🌱 POINTS', 'ECO XP')
    
    # 2. Colorize Eco XP text
    # In page.tsx
    content = content.replace('className="text-zinc-400 font-black text-xs">+50 Eco XP', 'className="text-[#d4af37] font-black text-xs">+50 Eco XP')
    content = content.replace('className="text-zinc-400 text-sm font-black">+20 Eco XP', 'className="text-[#d4af37] text-sm font-black">+20 Eco XP')
    
    # In feed/page.tsx
    content = content.replace('className="text-zinc-400 text-xs font-black">+10 Eco XP', 'className="text-[#d4af37] text-xs font-black">+10 Eco XP')
    
    # In profile/page.tsx
    content = content.replace('className="text-xl font-black text-white">{user.xp} Eco XP', 'className="text-xl font-black text-[#d4af37]">{user.xp} Eco XP')
    content = content.replace('className="text-xl font-bold text-white mb-4">Badges', 'className="text-xl font-bold text-[#d4af37] mb-4">Badges')
    
    # In leaderboard/page.tsx
    content = content.replace('className="text-zinc-400 text-xs font-black">{top3[1]?.xp} Eco XP', 'className="text-[#d4af37] text-xs font-black">{top3[1]?.xp} Eco XP')
    content = content.replace('className="text-zinc-400 text-sm font-black">{top3[0]?.xp} Eco XP', 'className="text-[#d4af37] text-sm font-black">{top3[0]?.xp} Eco XP')
    content = content.replace('className="text-zinc-400 text-xs font-black">{top3[2]?.xp} Eco XP', 'className="text-[#d4af37] text-xs font-black">{top3[2]?.xp} Eco XP')
    content = content.replace('className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Eco XP', 'className="text-[10px] font-bold text-[#d4af37] uppercase tracking-wider">Eco XP')
    
    # Give the numbers in the leaderboard list a gold color too
    content = content.replace('className="font-black text-white">{user.xp}</span>', 'className="font-black text-[#d4af37]">{user.xp}</span>')
    content = content.replace('className="text-3xl font-bold text-white tracking-tight">Standings', 'className="text-3xl font-bold text-[#d4af37] tracking-tight">Standings')
    
    # In report/page.tsx
    content = content.replace('+10 Eco XP Earned!', '<span className="text-[#d4af37]">+10 Eco XP Earned!</span>')
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Applied gold accents and renamed to Eco XP.")
