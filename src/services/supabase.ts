export { supabase } from '@/integrations/supabase/client';
import { supabase } from '@/integrations/supabase/client';

let inFlightUserIdPromise: Promise<string> | null = null;

export async function requireUserId(): Promise<string> {
  // 1. Fast path: check active session from memory/storage (0ms, no network call)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return session.user.id;
    }
  } catch {
    // Ignore and proceed to fallback
  }

  // 2. Fallback: deduplicate concurrent network calls to getUser()
  if (!inFlightUserIdPromise) {
    inFlightUserIdPromise = (async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!user?.id) throw new Error('Not authenticated');
        return user.id;
      } finally {
        inFlightUserIdPromise = null;
      }
    })();
  }

  return inFlightUserIdPromise;
}

