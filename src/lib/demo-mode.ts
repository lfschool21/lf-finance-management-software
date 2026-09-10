import type { User } from '@supabase/supabase-js';

let demoBootstrapping = false;
const listeners = new Set<(isBootstrapping: boolean) => void>();

export function isDemoUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.is_anonymous || user.app_metadata?.provider === 'anonymous');
}

export function isDemoBootstrapping(): boolean {
  return demoBootstrapping;
}

export function setDemoBootstrapping(val: boolean): void {
  demoBootstrapping = val;
  listeners.forEach((listener) => listener(val));
}

export function onDemoBootstrappingChange(callback: (isBootstrapping: boolean) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
