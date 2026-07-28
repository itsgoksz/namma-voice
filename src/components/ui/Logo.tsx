import React from 'react';

interface LogoProps {
  className?: string;
  color?: string;
}

export const Logo = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`relative ${className}`}>
      <img 
        src="/logo.png?v=6" 
        alt="Namma Hood Logo" 
        className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]"
      />
    </div>
  );
};
