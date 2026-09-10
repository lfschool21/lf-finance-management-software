import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  /** Subtitle / description shown below the title */
  subtitle?: string;
  /** Primary CTA rendered on the right (mobile: full-width below title) */
  action?: ReactNode;
  /** Additional secondary actions (rendered inline with primary on desktop) */
  secondaryActions?: ReactNode;
}

export function PageHeader({ title, subtitle, action, secondaryActions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && (
          <p className="text-fit text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {(action || secondaryActions) && (
        <div className="flex items-center gap-2">
          {secondaryActions}
          {action}
        </div>
      )}
    </div>
  );
}
