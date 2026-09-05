import { useEffect, type ReactNode } from 'react';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AppInitializer({ children }: { children: ReactNode }) {
  const { init, isInitialized, isLoading, error } = useFinanceStore();
  const { init: initStudents, isInitialized: areStudentsInitialized, isLoading: areStudentsLoading, error: studentsError } = useStudentStore();

  useEffect(() => {
    if (!isInitialized) {
      init();
    }
    if (!areStudentsInitialized) initStudents();
  }, [areStudentsInitialized, init, initStudents, isInitialized]);

  if (!isInitialized || isLoading || !areStudentsInitialized || areStudentsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || studentsError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-sm space-y-3 rounded-lg border bg-card p-5 text-center">
          <p className="font-medium">Finance data could not be loaded</p>
          <p className="text-sm text-muted-foreground">{error || studentsError}</p>
          <Button onClick={() => { void init(); void initStudents(true); }}>Retry</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
