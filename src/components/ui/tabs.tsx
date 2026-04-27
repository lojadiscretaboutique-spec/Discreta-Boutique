import React from 'react';
import { cn } from '../lib/utils';

interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: React.ElementType;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn("flex flex-wrap border-b border-slate-200 bg-white sticky top-0 z-20 px-1 pt-1", className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            type="button"
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative border-b-2 -mb-[2px]",
              isActive 
                ? "border-red-600 text-red-600" 
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            {Icon && <Icon size={16} />}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                "px-1.5 py-0.5 text-[10px] rounded-full font-bold",
                isActive ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
