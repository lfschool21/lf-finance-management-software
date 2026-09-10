import { supabase } from '@/services/supabase';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import { isDemoUser, setDemoBootstrapping } from '@/lib/demo-mode';

export interface StartDemoOptions {
  captchaToken?: string;
}

export async function startDemo(options?: StartDemoOptions): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (userData?.user && !isDemoUser(userData.user)) {
    throw new Error('A registered account is already signed in. Please sign out before entering demo mode.');
  }

  setDemoBootstrapping(true);

  try {
    useFinanceStore.getState().reset();
    useStudentStore.getState().reset();

    let currentUser = userData?.user;
    if (!currentUser || !isDemoUser(currentUser)) {
      const { data: anonRes, error: anonError } = await supabase.auth.signInAnonymously(
        options?.captchaToken ? { options: { captchaToken: options.captchaToken } } : undefined,
      );
      if (anonError) {
        if (
          anonError.message?.toLowerCase().includes('disabled') ||
          (anonError as unknown as { code?: string }).code === 'anonymous_provider_disabled'
        ) {
          const message = import.meta.env.DEV
            ? 'Anonymous sign-ins are disabled on this Supabase project. Please enable Anonymous Sign-Ins in Supabase Dashboard -> Authentication -> Providers -> Anonymous.'
            : 'Demo is temporarily unavailable. Anonymous sign-ins are currently disabled on the authentication server.';
          throw new Error(message);
        }
        throw anonError;
      }
      currentUser = anonRes.user;
    }

    if (!currentUser) {
      throw new Error('Could not establish an anonymous demo session.');
    }

    const { error: seedError } = await supabase.rpc('ensure_demo_workspace');
    if (seedError) {
      if (seedError.message?.includes('ensure_demo_workspace')) {
        const message = import.meta.env.DEV
          ? 'Demo database functions are not deployed. Please apply the 20260905000100_demo_workspace.sql migration to this database.'
          : 'Demo workspace initialization failed. Please try again later.';
        throw new Error(message);
      }
      throw seedError;
    }

    await Promise.all([
      useFinanceStore.getState().init(true, currentUser.id),
      useStudentStore.getState().init(true, currentUser.id),
    ]);
  } finally {
    setDemoBootstrapping(false);
  }
}

export async function resetDemo(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user || !isDemoUser(userData.user)) {
    throw new Error('Demo reset is only available within an active demo session.');
  }

  setDemoBootstrapping(true);
  try {
    const { error: resetError } = await supabase.rpc('reset_demo_workspace');
    if (resetError) throw resetError;

    useFinanceStore.getState().reset();
    useStudentStore.getState().reset();

    await Promise.all([
      useFinanceStore.getState().init(true, userData.user.id),
      useStudentStore.getState().init(true, userData.user.id),
    ]);
  } finally {
    setDemoBootstrapping(false);
  }
}

export async function exitDemo(): Promise<void> {
  setDemoBootstrapping(false);
  useFinanceStore.getState().reset();
  useStudentStore.getState().reset();

  try {
    await supabase.rpc('discard_demo_workspace');
  } catch (err) {
    console.warn('Demo cleanup note:', err);
  }

  await supabase.auth.signOut();
}
