import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  badge,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#14201A]/10">
      <div>
        {badge && (
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#0B3D2E] mb-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[#0B3D2E]" />
            {badge}
          </div>
        )}
        <h1 className="font-serif text-3xl md:text-4xl text-[#0B3D2E] font-medium tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-[rgb(90,102,96)] mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
