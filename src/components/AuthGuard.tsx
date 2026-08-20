import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChange, getSession } from '@/services/auth';
import { supabase } from '@/services/supabase';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthGuardProps {
  children: ReactNode;
  requireSetup?: boolean;
}

export function AuthGuard({ children, requireSetup = true }: AuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const subscription = onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthenticated(false);
        setLoading(false);
        navigate('/login', { replace: true });
      } else {
        setAuthenticated(true);
        if (requireSetup) {
          checkSetup();
        } else {
          setLoading(false);
        }
      }
    });

    getSession().then(async ({ data, error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }
      if (!data.session) {
        setAuthenticated(false);
        setLoading(false);
        navigate('/login', { replace: true });
      } else {
        setAuthenticated(true);
        if (requireSetup) {
          await checkSetup();
        } else {
          setLoading(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkSetup() {
    try {
      setError('');
      const [accountsResult, yearsResult] = await Promise.all([
        supabase.from('accounts').select('id').limit(1),
        supabase.from('academic_years').select('id').limit(1),
      ]);
      if (accountsResult.error) throw accountsResult.error;
      if (yearsResult.error) throw yearsResult.error;
      const setupComplete = (accountsResult.data?.length || 0) > 0 && (yearsResult.data?.length || 0) > 0;
      if (!setupComplete) {
        if (location.pathname !== '/setup') {
          navigate('/setup', { replace: true });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify setup');
    }
    setLoading(false);
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-sm space-y-3 rounded-lg border bg-card p-5 text-center">
          <p className="font-medium">Could not verify your finance workspace</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => { setLoading(true); void checkSetup(); }}>Retry</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authenticated) return null;

  return <>{children}</>;
}
