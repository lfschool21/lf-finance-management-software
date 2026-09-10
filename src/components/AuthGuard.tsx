import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChange, getSession } from '@/services/auth';
import { Loader2 } from 'lucide-react';
import { isDemoBootstrapping, onDemoBootstrappingChange } from '@/lib/demo-mode';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unbindBootstrap = onDemoBootstrappingChange((bootstrapping) => {
      setLoading(bootstrapping);
    });

    const subscription = onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthenticated(false);
        setLoading(false);
        navigate('/login', { replace: true });
      } else {
        setAuthenticated(true);
        if (!isDemoBootstrapping()) {
          setLoading(false);
        }
      }
    });

    getSession().then(async ({ data, error: sessionError }) => {
      if (sessionError || !data?.session) {
        setAuthenticated(false);
        setLoading(false);
        navigate('/login', { replace: true });
        return;
      }
      setAuthenticated(true);
      if (!isDemoBootstrapping()) {
        setLoading(false);
      }
    });

    return () => {
      unbindBootstrap();
      subscription.unsubscribe();
    };
  }, [navigate]);

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
