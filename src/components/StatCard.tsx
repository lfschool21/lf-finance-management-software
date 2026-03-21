import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  variant: 'income' | 'expense' | 'profit' | 'balance' | 'pending' | 'cumulative';
  subtitle?: string;
  className?: string;
}

const variantStyles: Record<StatCardProps['variant'], string> = {
  income: 'bg-income/10 text-income border-income/20',
  expense: 'bg-expense/10 text-expense border-expense/20',
  profit: 'bg-profit/10 text-profit border-profit/20',
  balance: 'bg-primary/10 text-primary border-primary/20',
  pending: 'bg-warning/10 text-warning border-warning/20',
  cumulative: 'bg-profit/10 text-profit border-profit/20',
};

const iconBgStyles: Record<StatCardProps['variant'], string> = {
  income: 'bg-income/20',
  expense: 'bg-expense/20',
  profit: 'bg-profit/20',
  balance: 'bg-primary/20',
  pending: 'bg-warning/20',
  cumulative: 'bg-profit/20',
};

export function StatCard({ title, value, icon: Icon, variant, subtitle, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all duration-300 hover:shadow-md animate-fade-in',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider opacity-70">{title}</p>
          <p className="mt-1 truncate font-mono text-xl font-bold leading-tight sm:text-2xl">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs opacity-60">{subtitle}</p>}
        </div>
        <div className={cn('flex-shrink-0 rounded-lg p-2', iconBgStyles[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
