import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, RotateCcw, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { resetDemo, exitDemo } from '@/services/demo';
import { isDemoUser } from '@/lib/demo-mode';
import { supabase } from '@/services/supabase';
import { toast } from '@/hooks/use-toast';

export function DemoBanner() {
  const navigate = useNavigate();
  const [isDemo, setIsDemo] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsDemo(isDemoUser(user));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsDemo(isDemoUser(session?.user));
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!isDemo) return null;

  async function handleReset() {
    setShowResetConfirm(false);
    setResetting(true);
    try {
      await resetDemo();
      toast({ title: 'Demo data has been reset.', description: 'The sample workspace has been restored.' });
      navigate('/', { replace: true });
    } catch (err) {
      toast({
        title: 'Reset failed',
        description: err instanceof Error ? err.message : 'Could not reset demo data',
        variant: 'destructive',
      });
    } finally {
      setResetting(false);
    }
  }

  async function handleExit() {
    setExiting(true);
    try {
      await exitDemo();
      toast({ title: 'Exited demo', description: 'Thank you for exploring Little Flowers Finance Tracker.' });
      navigate('/login', { replace: true });
    } catch (err) {
      toast({
        title: 'Exit failed',
        description: err instanceof Error ? err.message : 'Could not exit demo',
        variant: 'destructive',
      });
      navigate('/login', { replace: true });
    } finally {
      setExiting(false);
    }
  }

  return (
    <>
      <aside
        role="region"
        aria-label="Demo mode indicator"
        className="w-full border-b border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-xs sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-900 dark:text-amber-200">
              <Sparkles className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              Demo Mode
            </span>
            <span className="hidden truncate text-[11px] text-muted-foreground sm:inline min-[480px]:inline">
              You are exploring sample data. Changes in this workspace are disposable.
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resetting || exiting}
              onClick={() => setShowResetConfirm(true)}
              className="h-7 gap-1 border-amber-500/30 bg-background/80 px-2 text-[11px] hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-100"
            >
              {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Reset Demo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resetting || exiting}
              onClick={handleExit}
              className="h-7 gap-1 border-amber-500/30 bg-background/80 px-2 text-[11px] hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-100"
            >
              {exiting ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
              Exit Demo
            </Button>
          </div>
        </div>
      </aside>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Demo Workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will erase all changes you have made in this disposable demo session and restore the original sample school dataset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-amber-600 text-white hover:bg-amber-700">
              Reset Demo Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
