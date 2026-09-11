import { useEffect, useState, type ReactNode } from 'react';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isDemoBootstrapping, onDemoBootstrappingChange } from '@/lib/demo-mode';

export function AppInitializer({ children }: { children: ReactNode }) {
  const [bootstrapping, setBootstrapping] = useState(isDemoBootstrapping());
  const [retrying, setRetrying] = useState(false);
  const { init, isInitialized, isLoading, error } = useFinanceStore();
  const { init: initStudents, isInitialized: areStudentsInitialized, isLoading: areStudentsLoading, error: studentsError } = useStudentStore();

  useEffect(() => {
    return onDemoBootstrappingChange((isBootstrapping) => {
      setBootstrapping(isBootstrapping);
    });
  }, []);

  useEffect(() => {
    if (bootstrapping) return;
    if (!isInitialized && !isLoading && !error) {
      void init();
    }
    if (!areStudentsInitialized && !areStudentsLoading && !studentsError) {
      void initStudents();
    }
  }, [areStudentsInitialized, areStudentsLoading, bootstrapping, error, init, initStudents, isInitialized, isLoading, studentsError]);

  if (error || studentsError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-sm space-y-3 rounded-lg border bg-card p-5 text-center">
          <p className="font-medium">Finance data could not be loaded</p>
          <p className="text-sm text-muted-foreground">{error || studentsError}</p>
          <Button
            onClick={async () => {
              setRetrying(true);
              try {
                await Promise.all([init(true), initStudents(true)]);
              } finally {
                setRetrying(false);
              }
            }}
            disabled={retrying || isLoading || areStudentsLoading}
          >
            {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (bootstrapping || !isInitialized || isLoading || !areStudentsInitialized || areStudentsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
