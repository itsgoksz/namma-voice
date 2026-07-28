import React from 'react';

interface LogoProps {
  className?: string;
  color?: string;
}

export function Logo({ className = "w-10 h-10", color = "#7EBD01" }: LogoProps) {
  return (
    <img 
      src="/logo.svg?v=5"
      alt="Namma Hood Logo"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
