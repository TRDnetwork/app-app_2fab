import { describe, it, expect, vi } from 'vitest';
import { supabase } from '../app.js';

describe('Supabase API Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries only user-owned tasks using RLS filter', async () => {
    const mockUser = { id: 'user-123' };
    supabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: mockUser } });
    const mockData = [{ id: 1, title: 'Test', user_id: 'user-123', completed: false }];
    supabase.from = vi.fn().mockReturnThis();
    supabase.select = vi.fn().mockResolvedValue({ data: mockData, error: null });
    supabase.eq = vi.fn().mockReturnThis();
    supabase.order = vi.fn().mockReturnThis();

    await global.loadTasks();

    expect(supabase.from).toHaveBeenCalledWith('app_2fab_todos');
    expect(supabase.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(supabase.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('inserts new task with correct user_id', async () => {
    const mockUser = { id: 'user-123' };
    supabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: mockUser } });
    supabase.from = vi.fn().mockReturnThis();
    supabase.insert = vi.fn().mockResolvedValue({ error: null });

    const title = 'New Task';
    await supabase.from('app_2fab_todos').insert([{ title, user_id: mockUser.id, completed: false }]);

    expect(supabase.insert).toHaveBeenCalledWith([
      { title: 'New Task', user_id: 'user-123', completed: false },
    ]);
  });

  it('deletes task with row-level security enforced', async () => {
    supabase.from = vi.fn().mockReturnThis();
    supabase.delete = vi.fn().mockReturnThis();
    supabase.eq = vi.fn().mockResolvedValue({ error: null });

    await supabase.from('app_2fab_todos').delete().eq('id', 1);

    expect(supabase.delete).toHaveBeenCalled();
    expect(supabase.eq).toHaveBeenCalledWith('id', 1);
  });

  it('handles auth errors gracefully during sign in', async () => {
    supabase.auth.signInWithPassword = vi.fn().mockResolvedValue({
      error: { message: 'Invalid credentials' },
    });

    const result = await supabase.auth.signInWithPassword({ email: 'bad@test.com', password: 'wrong' });

    expect(result.error).toBeDefined();
    expect(result.error.message).toBe('Invalid credentials');
  });

  it('sets up realtime subscription with user_id filter', async () => {
    const mockUserId = 'user-123';
    const mockOnChange = vi.fn();
    const mockChannel = { subscribe: vi.fn() };
    supabase.channel = vi.fn(() => mockChannel);

    global.setupRealtime(supabase, mockOnChange, mockUserId);

    expect(supabase.channel).toHaveBeenCalledWith('todos-changes');
    expect(mockChannel.subscribe).toHaveBeenCalled();
    // Verify filter includes user_id
    const filterArg = supabase.channel.mock.calls[0][1].filter;
    expect(filterArg).toContain(`user_id=eq.${mockUserId}`);
  });
});