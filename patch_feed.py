import re

with open('src/app/feed/page.tsx', 'r') as f:
    content = f.read()

# 1. Add getFastLocation import
content = content.replace(
    'import { Geolocation } from "@capacitor/geolocation";',
    'import { Geolocation } from "@capacitor/geolocation";\nimport { getFastLocation } from "@/lib/location";'
)

# 2. Add errorPopup state
content = content.replace(
    '  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);',
    '  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);\n  const [errorPopup, setErrorPopup] = useState<{ title: string; message: string } | null>(null);'
)

# 3. Replace handleCleanup try block
content = content.replace(
    '''      try {
        await Geolocation.requestPermissions();
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
        const dist = getDistanceInMeters(pos.coords.latitude, pos.coords.longitude, post.lat, post.lng);
        
        if (dist > 50) {
          alert(`You are too far from the garbage location! (${Math.round(dist)}m away)\\n\\nYou must be physically present at the exact location to clean it up.`);
          return;
        }
      } catch (err) {
        alert("Failed to get your location. Please enable GPS to clean up this spot.");
        return;
      }''',
    '''      try {
        await Geolocation.requestPermissions();
        const pos = await getFastLocation();
        const dist = getDistanceInMeters(pos.lat, pos.lng, post.lat, post.lng);
        
        if (dist > 50) {
          setErrorPopup({
            title: "Too Far Away",
            message: `You are ${Math.round(dist)}m away from the garbage location. You must be physically present at the exact location to clean it up.`
          });
          return;
        }
      } catch (err) {
        setErrorPopup({
          title: "Location Failed",
          message: "Failed to get your location. Please enable GPS to clean up this spot."
        });
        return;
      }'''
)

# 4. Add the AnimatePresence block at the end
popup_jsx = '''      <AnimatePresence>
        {errorPopup && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setErrorPopup(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-[#ff4d6d]/20 flex items-center justify-center mb-4 border border-[#ff4d6d]/30">
                <AlertTriangle className="w-8 h-8 text-[#ff4d6d]" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">{errorPopup.title}</h2>
              <p className="text-zinc-400 font-medium mb-6 text-sm">{errorPopup.message}</p>
              <button
                onClick={() => setErrorPopup(null)}
                className="w-full py-3.5 bg-white/10 hover:bg-white/15 text-white font-black rounded-xl transition-colors"
              >
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
'''
content = content.replace(
    '    </div>\n  );\n}\n',
    popup_jsx
)

with open('src/app/feed/page.tsx', 'w') as f:
    f.write(content)
