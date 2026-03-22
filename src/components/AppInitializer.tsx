import { useEffect, type ReactNode } from 'react';
import { useFinanceStore } from '@/store/finance-store';
import { Loader2 } from 'lucide-react';

export function AppInitializer({ children }: { children: ReactNode }) {
  const { init, isInitialized, isLoading } = useFinanceStore();

  useEffect(() => {
    if (!isInitialized) {
      init();
    }
  }, [init, isInitialized]);

  if (!isInitialized || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
