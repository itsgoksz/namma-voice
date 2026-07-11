import os

files_to_update = [
    'src/app/page.tsx',
    'src/components/LoginOverlay.tsx',
    'src/components/BottomNav.tsx',
    'src/app/profile/page.tsx'
]

for filepath in files_to_update:
    path = os.path.join(os.getcwd(), filepath)
    if not os.path.exists(path):
        continue
        
    with open(path, 'r') as f:
        content = f.read()
    
    if 'page.tsx' in filepath and 'src/app/page.tsx' == filepath:
        # Navigate button
        content = content.replace('className="bg-[#10b981] text-white font-black py-3 px-6 rounded-xl', 'className="bg-white text-[#10b981] font-black py-3 px-6 rounded-xl')
        
    if 'LoginOverlay.tsx' in filepath:
        # Continue button
        content = content.replace('className="w-full bg-[#10b981] text-white font-black py-4', 'className="w-full bg-white text-[#10b981] font-black py-4')
        
    if 'BottomNav.tsx' in filepath:
        # Add button
        content = content.replace('className="bg-[#10b981] rounded-full p-4 flex items-center', 'className="bg-white rounded-full p-4 flex items-center')
        content = content.replace('<Icon className="w-8 h-8 text-white"', '<Icon className="w-8 h-8 text-[#10b981]"')
        
        # Indicator dot
        content = content.replace('bg-[#10b981] rounded-full"', 'bg-white rounded-full"')
        
    if 'profile/page.tsx' in filepath:
        # Progress bar
        content = content.replace('className="bg-[#10b981] h-3 rounded-full', 'className="bg-white h-3 rounded-full')

    with open(path, 'w') as f:
        f.write(content)

print("Flipped solid mint green to white with mint green accents.")
