import { useEffect, type ReactNode } from 'react';
import { useFinanceStore } from '@/store/finance-store';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AppInitializer({ children }: { children: ReactNode }) {
  const { init, isInitialized, isLoading, error } = useFinanceStore();

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

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-sm space-y-3 rounded-lg border bg-card p-5 text-center">
          <p className="font-medium">Finance data could not be loaded</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => void init()}>Retry</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
