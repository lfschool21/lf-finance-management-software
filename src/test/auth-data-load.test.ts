import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireUserId, supabase } from '@/services/supabase';

describe('requireUserId auth optimization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves immediately from getSession() cache without calling getUser()', async () => {
    const mockSession = {
      user: { id: 'user-cached-123' },
    };

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: mockSession as any },
      error: null,
    });

    const getUserSpy = vi.spyOn(supabase.auth, 'getUser');

    const userId = await requireUserId();

    expect(userId).toBe('user-cached-123');
    expect(getUserSpy).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent calls when fallback to getUser is needed', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    });

    let getUserCalls = 0;
    vi.spyOn(supabase.auth, 'getUser').mockImplementation(async () => {
      getUserCalls++;
      // Simulate network delay
      await new Promise((res) => setTimeout(res, 20));
      return {
        data: { user: { id: 'user-fetched-456' } as any },
        error: null,
      };
    });

    // Fire 6 concurrent calls
    const results = await Promise.all([
      requireUserId(),
      requireUserId(),
      requireUserId(),
      requireUserId(),
      requireUserId(),
      requireUserId(),
    ]);

    expect(results).toEqual(Array(6).fill('user-fetched-456'));
    // Only 1 network call was made
    expect(getUserCalls).toBe(1);
  });
});
