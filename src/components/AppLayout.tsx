import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Settings,
  Search,
  ArrowLeftRight,
  GraduationCap,
  Landmark,
  HandCoins,
  MoreHorizontal,
  Users,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const NAV_GROUPS = [
  { label: 'Overview', items: [{ path: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'School', items: [{ path: '/students', label: 'Students', icon: Users }] },
  { label: 'Money', items: [
    { path: '/income', label: 'Income', icon: TrendingUp },
    { path: '/expenses', label: 'Expenses', icon: TrendingDown },
    { path: '/balances', label: 'Balances', icon: Landmark },
    { path: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
    { path: '/recoverables', label: 'Recoverables', icon: HandCoins },
  ] },
  { label: 'Insights', items: [
    { path: '/reports', label: 'Reports', icon: BarChart3 },
    { path: '/search', label: 'Search', icon: Search },
  ] },
  { label: 'System', items: [{ path: '/settings', label: 'Settings', icon: Settings }] },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

const BOTTOM_NAV = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/students', label: 'Students', icon: Users },
  { path: '/income', label: 'Income', icon: TrendingUp },
  { path: '/expenses', label: 'Expenses', icon: TrendingDown },
];

const MORE_ITEMS = [
  { path: '/balances', label: 'Balances', description: 'Review account liquidity', icon: Landmark },
  { path: '/transfers', label: 'Transfers', description: 'Move money between accounts', icon: ArrowLeftRight },
  { path: '/recoverables', label: 'Recoverables', description: 'Track advances and repayments', icon: HandCoins },
  { path: '/reports', label: 'Reports', description: 'Financial summaries and analytics', icon: BarChart3 },
  { path: '/search', label: 'Search', description: 'Find transactions quickly', icon: Search },
  { path: '/settings', label: 'Settings', description: 'Accounts, years, and preferences', icon: Settings },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const currentPage = pathname.startsWith('/students/') ? 'Student Profile' : NAV_ITEMS.find((item) => item.path === pathname)?.label || 'Dashboard';
  const moreActive = MORE_ITEMS.some((item) => item.path === pathname);

  return (
    <div className="mobile-safe flex min-h-screen w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent">
            <GraduationCap className="h-5 w-5 text-sidebar-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-foreground">Little Flowers</h1>
            <p className="text-[10px] text-sidebar-foreground/60">School Finance & Fees</p>
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/40">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.path;
                  return (
                    <Link key={item.path} to={item.path} className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive ? 'bg-sidebar-accent text-sidebar-primary' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                    )}>
                      <item.icon className="h-4.5 w-4.5" />{item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="mobile-safe flex flex-1 flex-col pb-16 md:pb-0">
        {/* Mobile header */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <div className="min-w-0">
              <span className="block text-xs font-bold leading-tight">Little Flowers</span>
              <span className="block truncate text-[10px] text-muted-foreground">{currentPage}</span>
            </div>
          </div>
          <Link to="/search" aria-label="Search transactions" className="rounded-md p-2">
            <Search className="h-5 w-5 text-muted-foreground" />
          </Link>
        </header>

        {/* Desktop header */}
        <header className="hidden h-14 items-center justify-between border-b bg-card px-6 md:flex">
          <p className="text-sm text-muted-foreground">Little Flowers School Finance Management</p>
          <Link
            to="/search"
            className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent"
          >
            <Search className="h-4 w-4" />
            <span>Search transactions...</span>
          </Link>
        </header>

        <main className="mobile-safe flex-1 overflow-auto">
          <div className="mobile-safe mx-auto max-w-7xl p-3 min-[380px]:p-4 md:p-6">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex overflow-x-auto border-t bg-card md:hidden">
        {BOTTOM_NAV.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex min-w-[4.5rem] flex-1 flex-col items-center gap-0.5 px-0.5 py-2 text-[9px] font-medium transition-colors min-[380px]:text-[10px]',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button type="button" className={cn(
              'flex min-w-[4.5rem] flex-1 flex-col items-center gap-0.5 px-0.5 py-2 text-[9px] font-medium transition-colors min-[380px]:text-[10px]',
              moreActive ? 'text-primary' : 'text-muted-foreground',
            )} aria-label="Open more navigation options">
              <MoreHorizontal className="h-5 w-5" />
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <SheetHeader><SheetTitle>More</SheetTitle></SheetHeader>
            <div className="mt-4 grid gap-2">
              {MORE_ITEMS.map((item) => (
                <Link key={item.path} to={item.path} onClick={() => setMoreOpen(false)} className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted',
                  pathname === item.path && 'border-primary/30 bg-primary/5',
                )}>
                  <div className="rounded-lg bg-primary/10 p-2"><item.icon className="h-4 w-4 text-primary" /></div>
                  <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.description}</p></div>
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
