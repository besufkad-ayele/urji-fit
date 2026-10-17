'use client';

import React from 'react';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export default function TabNavigation({
  tabs,
  activeTab,
  onChange,
}: TabNavigationProps) {
  return (
    <div className="flex items-center gap-1 bg-[#F3EFE5]/50 p-1 rounded-xl border border-[#14201A]/5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === tab.id
              ? 'bg-[#0B3D2E] text-[#F2F7D9] shadow-sm'
              : 'text-[rgb(90,102,96)] hover:text-[#0B3D2E] hover:bg-white/50'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                activeTab === tab.id
                  ? 'bg-[#F2F7D9] text-[#0B3D2E]'
                  : 'bg-black/10 text-[rgb(90,102,96)]'
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
