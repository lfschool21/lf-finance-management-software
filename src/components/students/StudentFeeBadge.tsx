import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export type FeeStatus = 'paid' | 'partially_paid' | 'not_paid';

interface StudentFeeBadgeProps {
  status: FeeStatus;
  className?: string;
  size?: 'sm' | 'default';
}

export function StudentFeeBadge({ status, className, size = 'default' }: StudentFeeBadgeProps) {
  const configs = {
    paid: {
      label: 'Paid',
      icon: CheckCircle2,
      style: 'bg-income/10 text-income border-income/30 hover:bg-income/20',
    },
    partially_paid: {
      label: 'Partial',
      icon: Clock,
      style: 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20',
    },
    not_paid: {
      label: 'Unpaid',
      icon: AlertCircle,
      style: 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
    },
  };

  const config = configs[status] || configs.not_paid;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1 font-medium select-none transition-colors',
        size === 'sm' ? 'px-1.5 py-0 text-[11px]' : 'px-2 py-0.5 text-xs',
        config.style,
        className
      )}
    >
      <Icon className={cn(size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5', 'shrink-0')} aria-hidden="true" />
      <span>{config.label}</span>
    </Badge>
  );
}
