import React from 'react';
import { LucideIcon } from 'lucide-react';

interface QuickActionButtonProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  disabled?: boolean;
}

export default function QuickActionButton({
  label,
  icon: Icon,
  onClick,
  variant = 'primary',
  disabled = false,
}: QuickActionButtonProps) {
  const variantStyles = {
    primary: 'bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9]',
    secondary: 'bg-white hover:bg-[#F2F7D9]/60 text-[#0B3D2E] border border-[#14201A]/10',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
