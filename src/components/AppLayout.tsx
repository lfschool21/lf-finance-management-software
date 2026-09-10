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
import { DemoBanner } from '@/components/DemoBanner';
import { useTranslation, translations, type TranslationKey } from '@/lib/i18n';

interface NavItemConfig {
  path: string;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroupConfig {
  groupKey: TranslationKey;
  items: NavItemConfig[];
}

interface MoreItemConfig extends NavItemConfig {
  descKey: TranslationKey;
}

const NAV_GROUPS: NavGroupConfig[] = [
  { groupKey: 'navOverview', items: [{ path: '/', labelKey: 'navDashboard', icon: LayoutDashboard }] },
  { groupKey: 'navSchool', items: [{ path: '/students', labelKey: 'navStudents', icon: Users }] },
  { groupKey: 'navMoney', items: [
    { path: '/income', labelKey: 'navIncome', icon: TrendingUp },
    { path: '/expenses', labelKey: 'navExpenses', icon: TrendingDown },
    { path: '/balances', labelKey: 'navBalances', icon: Landmark },
    { path: '/transfers', labelKey: 'navTransfers', icon: ArrowLeftRight },
    { path: '/recoverables', labelKey: 'navRecoverables', icon: HandCoins },
  ] },
  { groupKey: 'navInsights', items: [
    { path: '/reports', labelKey: 'navReports', icon: BarChart3 },
    { path: '/search', labelKey: 'navSearch', icon: Search },
  ] },
  { groupKey: 'navSystem', items: [{ path: '/settings', labelKey: 'navSettings', icon: Settings }] },
];

const BOTTOM_NAV: NavItemConfig[] = [
  { path: '/', labelKey: 'navDashboard', icon: LayoutDashboard },
  { path: '/students', labelKey: 'navStudents', icon: Users },
  { path: '/income', labelKey: 'navIncome', icon: TrendingUp },
  { path: '/expenses', labelKey: 'navExpenses', icon: TrendingDown },
];

const MORE_ITEMS: MoreItemConfig[] = [
  { path: '/balances', labelKey: 'navBalances', descKey: 'moreBalancesDesc', icon: Landmark },
  { path: '/transfers', labelKey: 'navTransfers', descKey: 'moreTransfersDesc', icon: ArrowLeftRight },
  { path: '/recoverables', labelKey: 'navRecoverables', descKey: 'moreRecoverablesDesc', icon: HandCoins },
  { path: '/reports', labelKey: 'navReports', descKey: 'moreReportsDesc', icon: BarChart3 },
  { path: '/search', labelKey: 'navSearch', descKey: 'moreSearchDesc', icon: Search },
  { path: '/settings', labelKey: 'navSettings', descKey: 'moreSettingsDesc', icon: Settings },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { t, language, setLanguage } = useTranslation();

  const tEn = t;

  /** Match nav items: exact for '/' (dashboard), startsWith for all others */
  function isNavActive(itemPath: string): boolean {
    if (itemPath === '/') return pathname === '/';
    return pathname === itemPath || pathname.startsWith(itemPath + '/');
  }

  const allNavItems = NAV_GROUPS.flatMap((group) => group.items);
  const currentNavItem = allNavItems.find((item) => isNavActive(item.path));
  const currentPage = currentNavItem
    ? (pathname.startsWith('/students/') ? t('studentProfile') : t(currentNavItem.labelKey))
    : t('navDashboard');
  const moreActive = MORE_ITEMS.some((item) => isNavActive(item.path));

  const LanguageSwitcher = ({ className }: { className?: string }) => (
    <div
      role="group"
      aria-label="Language selector"
      className={cn('flex items-center rounded-lg border border-border bg-muted/50 p-0.5 text-xs', className)}
    >
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2 py-0.5 rounded font-semibold transition-colors ${
          language === 'en'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        aria-pressed={language === 'en'}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('gu')}
        className={`px-2 py-0.5 rounded font-semibold transition-colors ${
          language === 'gu'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        aria-pressed={language === 'gu'}
      >
        ગુજરાતી
      </button>
    </div>
  );

  return (
    <div className="mobile-safe flex min-h-screen w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent">
            <GraduationCap className="h-5 w-5 text-sidebar-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-foreground">{tEn('appTitle')}</h1>
            <p className="text-[10px] text-sidebar-foreground/60">{tEn('appSubtitle')}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.groupKey}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/40">
                {tEn(group.groupKey)}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = isNavActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-primary'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="h-4.5 w-4.5" />
                      {tEn(item.labelKey)}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer with Language Switcher */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs text-sidebar-foreground/60">Language:</span>
            <LanguageSwitcher />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="mobile-safe flex flex-1 flex-col pb-16 md:pb-0">
        <DemoBanner />
        {/* Mobile header */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <div className="min-w-0">
              <span className="block text-xs font-bold leading-tight">{tEn('appTitle')}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{currentPage}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link to="/search" aria-label={tEn('actionSearch')} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
              <Search className="h-5 w-5" />
            </Link>
          </div>
        </header>

        {/* Desktop header */}
        <header className="hidden h-14 items-center justify-between border-b bg-card px-6 md:flex">
          <p className="text-sm text-muted-foreground">{tEn('appHeaderSubtitle')}</p>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              to="/search"
              className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent"
            >
              <Search className="h-4 w-4" />
              <span>{tEn('searchPlaceholder')}</span>
            </Link>
          </div>
        </header>

        <main className="mobile-safe flex-1 overflow-auto">
          <div className="mobile-safe mx-auto max-w-7xl p-3 min-[380px]:p-4 md:p-6">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex overflow-x-auto border-t bg-card md:hidden">
        {BOTTOM_NAV.map((item) => {
          const isActive = isNavActive(item.path);
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
              <span className="max-w-full truncate">{tEn(item.labelKey)}</span>
            </Link>
          );
        })}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex min-w-[4.5rem] flex-1 flex-col items-center gap-0.5 px-0.5 py-2 text-[9px] font-medium transition-colors min-[380px]:text-[10px]',
                moreActive ? 'text-primary' : 'text-muted-foreground'
              )}
              aria-label={tEn('navMore')}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>{tEn('navMore')}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <SheetHeader>
              <div className="flex items-center justify-between pr-6">
                <SheetTitle>{tEn('navMore')}</SheetTitle>
                <LanguageSwitcher />
              </div>
            </SheetHeader>
            <div className="mt-4 grid gap-2">
              {MORE_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted',
                    isNavActive(item.path) && 'border-primary/30 bg-primary/5'
                  )}
                >
                  <div className="rounded-lg bg-primary/10 p-2">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{tEn(item.labelKey)}</p>
                    <p className="text-xs text-muted-foreground">{tEn(item.descKey)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}

export default AppLayout;
