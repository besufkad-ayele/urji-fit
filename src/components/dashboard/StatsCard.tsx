import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onClick?: () => void;
}

export default function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-[#0B3D2E]',
  trend,
  onClick,
}: StatsCardProps) {
  return (
    <div
      className={`bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-5 shadow-sm transition-all ${
        onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase font-semibold text-[rgb(90,102,96)] tracking-wider">
          {title}
        </span>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="font-serif text-3xl text-[#14201A] mb-1">{value}</div>
      {subtitle && (
        <p className="text-xs text-[rgb(90,102,96)] mt-1">{subtitle}</p>
      )}
      {trend && (
        <div className={`text-xs font-semibold mt-2 ${trend.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% vs last month
        </div>
      )}
    </div>
  );
}
