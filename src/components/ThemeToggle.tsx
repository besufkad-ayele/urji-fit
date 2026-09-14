'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  variant?: 'icon' | 'pill' | 'sidebar';
  className?: string;
}

export default function ThemeToggle({ variant = 'icon', className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a placeholder with the same dimensions to avoid layout shift
    return (
      <div
        className={`inline-flex items-center justify-center ${
          variant === 'sidebar'
            ? 'w-full py-2 px-3 h-9 rounded-xl'
            : variant === 'pill'
            ? 'px-3 py-1.5 h-8 rounded-xl'
            : 'w-8 h-8 rounded-lg'
        } ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = theme === 'dark';

  if (variant === 'sidebar') {
    return (
      <button
        onClick={toggleTheme}
        type="button"
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
          isDark
            ? 'bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[#EDEAE3] border border-[rgba(255,255,255,0.08)]'
            : 'bg-[#F2F7D9]/70 hover:bg-[#F2F7D9] text-[#0B3D2E] border border-[#0B3D2E]/10'
        } ${className}`}
      >
        <div className="flex items-center gap-2.5">
          {isDark ? (
            <Moon className="w-3.5 h-3.5 text-[#E17046]" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-[#0B3D2E]" />
          )}
          <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
        </div>
        <span
          className={`w-2 h-2 rounded-full ${
            isDark ? 'bg-[#E17046] shadow-[0_0_8px_#E17046]' : 'bg-[#0B3D2E]'
          }`}
        />
      </button>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        onClick={toggleTheme}
        type="button"
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
          isDark
            ? 'bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-[#EDEAE3] border border-[rgba(255,255,255,0.08)]'
            : 'bg-white hover:bg-[#F2F7D9]/60 text-[#14201A] border border-[#14201A]/10 shadow-xs'
        } ${className}`}
      >
        {isDark ? (
          <>
            <Moon className="w-3.5 h-3.5 text-[#E17046]" />
            <span className="text-[11px]">Dark</span>
          </>
        ) : (
          <>
            <Sun className="w-3.5 h-3.5 text-[#C1502E]" />
            <span className="text-[11px]">Light</span>
          </>
        )}
      </button>
    );
  }

  // Icon only
  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
        isDark
          ? 'text-[#EDEAE3] hover:text-[#E17046] hover:bg-[rgba(255,255,255,0.08)]'
          : 'text-[rgb(90,102,96)] hover:text-[#0B3D2E] hover:bg-[#0B3D2E]/5'
      } ${className}`}
    >
      {isDark ? (
        <Moon className="w-4 h-4 text-[#E17046]" />
      ) : (
        <Sun className="w-4 h-4 text-[#0B3D2E]" />
      )}
    </button>
  );
}
