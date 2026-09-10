import React from 'react';
import { useTranslation } from '@/lib/i18n';
import type { StudentMedium } from '@/types/students';

interface StudentMediumSwitcherProps {
  activeMedium: 'all' | StudentMedium;
  onChange: (medium: 'all' | StudentMedium) => void;
  allCount: number;
  gujaratiCount: number;
  englishCount: number;
}

export function StudentMediumSwitcher({
  activeMedium,
  onChange,
  allCount,
  gujaratiCount,
  englishCount,
}: StudentMediumSwitcherProps) {
  const { t } = useTranslation();

  const tabs = [
    {
      id: 'all' as const,
      label: t('allStudentsTab'),
      shortLabel: 'All',
      count: allCount,
      dotClass: 'bg-foreground/50',
      activeBorderClass: 'border-primary/40 shadow-sm bg-card text-foreground ring-1 ring-primary/20',
      badgeActiveClass: 'bg-primary/10 text-primary font-bold',
      badgeInactiveClass: 'bg-muted text-muted-foreground',
    },
    {
      id: 'gujarati' as const,
      label: t('gujaratiMedium'),
      shortLabel: 'Gujarati',
      count: gujaratiCount,
      dotClass: 'bg-amber-600 dark:bg-amber-400',
      activeBorderClass: 'border-amber-500/50 shadow-sm bg-card text-foreground ring-1 ring-amber-500/30',
      badgeActiveClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold',
      badgeInactiveClass: 'bg-muted text-muted-foreground',
    },
    {
      id: 'english' as const,
      label: t('englishMedium'),
      shortLabel: 'English',
      count: englishCount,
      dotClass: 'bg-sky-600 dark:bg-sky-400',
      activeBorderClass: 'border-sky-500/50 shadow-sm bg-card text-foreground ring-1 ring-sky-500/30',
      badgeActiveClass: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 font-bold',
      badgeInactiveClass: 'bg-muted text-muted-foreground',
    },
  ];

  return (
    <nav
      aria-label="Medium Workspace"
      role="tablist"
      className="inline-flex w-full sm:w-auto items-center p-1 rounded-xl bg-muted/60 border border-border/80 gap-1"
    >
      {tabs.map((tab) => {
        const isActive = activeMedium === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            id={`medium-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls="student-roster-workspace"
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = (tabs.findIndex((t) => t.id === tab.id) + 1) % tabs.length;
                onChange(tabs[nextIndex].id);
                document.getElementById(`medium-tab-${tabs[nextIndex].id}`)?.focus();
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = (tabs.findIndex((t) => t.id === tab.id) - 1 + tabs.length) % tabs.length;
                onChange(tabs[prevIndex].id);
                document.getElementById(`medium-tab-${tabs[prevIndex].id}`)?.focus();
              }
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isActive
                ? tab.activeBorderClass
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full shrink-0 transition-transform ${tab.dotClass} ${
                isActive ? 'scale-110' : 'opacity-60'
              }`}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap hidden xs:inline sm:inline">{tab.label}</span>
            <span className="whitespace-nowrap inline xs:hidden sm:hidden">{tab.shortLabel}</span>

            {/* Dynamic Counter Badge */}
            <span
              className={`ml-0.5 px-2 py-0.5 rounded-full text-[11px] font-mono transition-colors ${
                isActive ? tab.badgeActiveClass : tab.badgeInactiveClass
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
