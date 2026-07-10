"use client";

import { useEffect, useState } from "react";

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  isLarge: boolean;
  opacity: number;
  animDuration: number;
}

export default function Starfield() {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    // Generate static stars once on client side to avoid hydration mismatch
    const generatedStars: Star[] = [];
    for (let i = 0; i < 100; i++) {
      const isLarge = Math.random() > 0.95; // 5% chance of being a large pinkish star
      generatedStars.push({
        id: i,
        x: Math.random() * 100, // percentage
        y: Math.random() * 100, // percentage
        size: isLarge ? Math.random() * 4 + 3 : Math.random() * 2 + 0.5,
        isLarge,
        opacity: isLarge ? Math.random() * 0.5 + 0.5 : Math.random() * 0.8 + 0.2,
        animDuration: Math.random() * 3 + 2,
      });
    }
    setStars(generatedStars);
  }, []);

  if (stars.length === 0) return <div className="starfield-bg" />;

  return (
    <div className="starfield-bg pointer-events-none">
      {stars.map((star) => (
        <div
          key={star.id}
          className={`star ${star.isLarge ? "large" : ""}`}
          style={{
            left: `${star.x}vw`,
            top: `${star.y}vh`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animation: star.isLarge ? `twinkle ${star.animDuration}s infinite alternate ease-in-out` : undefined,
            willChange: star.isLarge ? 'opacity' : 'auto'
          }}
        />
      ))}
    </div>
  );
}
