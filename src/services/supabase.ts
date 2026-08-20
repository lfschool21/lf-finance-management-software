export { supabase } from '@/integrations/supabase/client';
import { supabase } from '@/integrations/supabase/client';

export async function requireUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Not authenticated');
  return user.id;
}
