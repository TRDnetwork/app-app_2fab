import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/dom';
import '@testing-library/jest-dom';

// Mock Supabase globally
global.supabase = {
  auth: {
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(),
  channel: vi.fn(),
  createClient: vi.fn(() => global.supabase),
};

// Mock window variables
global.window.__SUPABASE_URL__ = 'https://mock.supabase.co';
global.window.__SUPABASE_ANON_KEY__ = 'mock-anon-key';

// Mock DOM
document.body.innerHTML = `
  <div id="loading" class="loading">Loading...</div>
  <div id="app" class="app" hidden>
    <header>
      <h1>TaskVault</h1>
      <button id="signOut" class="btn btn-secondary">Sign Out</button>
    </header>
    <main>
      <section id="auth" class="card">
        <form id="authForm">
          <input type="email" id="email" />
          <input type="password" id="password" />
          <button type="submit" name="action" value="signIn">Sign In</button>
          <button type="submit" name="action" value="signUp">Sign Up</button>
          <div id="authError"></div>
        </form>
      </section>
      <section id="dashboard" class="card" hidden>
        <form id="taskForm">
          <input type="text" id="taskTitle" />
          <button type="submit">Add Task</button>
          <div id="taskError"></div>
        </form>
        <ul id="taskList"></ul>
        <div id="emptyState">No tasks yet.</div>
      </section>
    </main>
  </div>
`;

// Import app.js (now safe to import with mocks in place)
await import('../app.js');

describe('TaskVault App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows auth form when user is not logged in', async () => {
    global.supabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    await global.renderApp();

    expect(screen.getByText('Sign In or Sign Up')).toBeVisible();
    expect(screen.queryByText('Your Tasks')).not.toBeInTheDocument();
  });

  it('shows dashboard when user is logged in', async () => {
    global.supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: '123', email: 'test@test.com' } },
    });
    global.supabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    await global.renderApp();

    expect(screen.getByText('Your Tasks')).toBeVisible();
    expect(screen.queryByText('Sign In or Sign Up')).not.toBeInTheDocument();
  });

  it('allows user to sign up', async () => {
    global.supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    global.supabase.auth.signUp.mockResolvedValue({ error: null });

    await global.renderApp();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Sign Up'));

    expect(global.supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'new@test.com',
      password: 'password123',
    });
  });

  it('displays error on failed task creation', async () => {
    global.supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: '123' } },
    });
    global.supabase.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { message: 'Insert failed' } }),
    });

    await global.renderApp();

    fireEvent.change(screen.getByLabelText('New Task'), { target: { value: 'Test task' } });
    fireEvent.click(screen.getByText('Add Task'));

    expect(await screen.findByText('Failed to add task: Insert failed')).toBeVisible();
  });

  it('toggles task completion state on Done/Undo click', async () => {
    global.supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: '123' } },
    });
    global.supabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
    });

    await global.renderApp();

    // Simulate task list item
    document.getElementById('taskList').innerHTML = `
      <li class="task-item" data-id="1">
        <span class="task-text">Test Task</span>
        <div class="task-actions">
          <button class="toggle-btn">Done</button>
        </div>
      </li>
    `;

    fireEvent.click(screen.getByText('Done'));

    expect(global.supabase.from).toHaveBeenCalledWith('app_2fab_todos');
    expect(global.supabase.from().update).toHaveBeenCalledWith({ completed: true });
  });
});