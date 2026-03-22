import { supabase } from './supabase';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession(): Promise<{ data: { session: Session | null }; error: Error | null }> {
  const { data, error } = await supabase.auth.getSession();
  return { data, error: error as Error | null };
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return subscription;
}
