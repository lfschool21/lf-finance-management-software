import React from 'react';
import type { StudentMedium } from '@/types/students';
import { MEDIUM_LABELS } from '@/types/students';

interface StudentMediumBadgeProps {
  medium: StudentMedium;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'badge' | 'compact' | 'pill';
  className?: string;
}

export function StudentMediumBadge({
  medium,
  size = 'sm',
  variant = 'badge',
  className = '',
}: StudentMediumBadgeProps) {
  const isEnglish = medium === 'english';

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 font-medium',
    sm: 'text-xs px-2 py-0.5 font-medium',
    md: 'text-xs sm:text-sm px-2.5 py-1 font-semibold',
  }[size];

  const colorClasses = isEnglish
    ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25'
    : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25';

  const dotClasses = isEnglish
    ? 'bg-sky-600 dark:bg-sky-400'
    : 'bg-amber-600 dark:bg-amber-400';

  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium ${colorClasses} rounded-md border ${sizeClasses} ${className}`}
        aria-label={`${MEDIUM_LABELS[medium]} Medium`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotClasses}`} aria-hidden="true" />
        <span>{isEnglish ? 'ENG · English' : 'GUJ · Gujarati'}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border ${colorClasses} ${sizeClasses} ${className}`}
      aria-label={`${MEDIUM_LABELS[medium]} Medium`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClasses}`} aria-hidden="true" />
      <span>{MEDIUM_LABELS[medium]} Medium</span>
    </span>
  );
}
