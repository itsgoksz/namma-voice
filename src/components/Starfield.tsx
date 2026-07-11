"use client";

import { useEffect, useState } from "react";
import { FileText, Trash2, Megaphone, Mic, Leaf, Wind } from "lucide-react";

interface FloatingElement {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  rotation: number;
  IconIndex: number;
}

const icons = [FileText, Trash2, Megaphone, Mic, Leaf, Wind];

export default function Starfield() {
  const [elements, setElements] = useState<FloatingElement[]>([]);

  useEffect(() => {
    // Generate static elements once on client side to avoid hydration mismatch
    const generated: FloatingElement[] = [];
    for (let i = 0; i < 25; i++) {
      generated.push({
        id: i,
        x: Math.random() * 100, // percentage
        y: Math.random() * 100, // percentage
        size: Math.random() * 20 + 16, // 16px to 36px
        opacity: Math.random() * 0.15 + 0.1, // 10% to 25% opacity so it's actually visible
        rotation: Math.random() * 360,
        IconIndex: Math.floor(Math.random() * icons.length)
      });
    }
    setElements(generated);
  }, []);

  if (elements.length === 0) return <div className="fixed inset-0 pointer-events-none -z-10" />;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {elements.map((el) => {
        const Icon = icons[el.IconIndex];
        return (
          <div
            key={el.id}
            className="absolute text-[#455d49]"
            style={{
              left: `${el.x}vw`,
              top: `${el.y}vh`,
              opacity: el.opacity,
              transform: `rotate(${el.rotation}deg)`,
            }}
          >
            <Icon size={el.size} strokeWidth={1.5} />
          </div>
        );
      })}
    </div>
  );
}
