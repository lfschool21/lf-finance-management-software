import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChange, getSession } from '@/services/auth';
import { supabase } from '@/services/supabase';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
  requireSetup?: boolean;
}

export function AuthGuard({ children, requireSetup = true }: AuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
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

    getSession().then(async ({ data }) => {
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
      const { data } = await supabase.from('accounts').select('id').limit(1);
      if (!data || data.length === 0) {
        if (location.pathname !== '/setup') {
          navigate('/setup', { replace: true });
        }
      }
    } catch {
      // If query fails, proceed anyway
    }
    setLoading(false);
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
