import { setupRealtime, teardownRealtime } from './realtime.js';

// Initialize Supabase client
let supabase;
try {
  if (!window.__SUPABASE_URL__ || !window.__SUPABASE_ANON_KEY__) {
    throw new Error('Missing Supabase credentials');
  }
  supabase = supabase.createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON_KEY__);
} catch (err) {
  document.body.innerHTML = `
    <div class="app">
      <div class="card">
        <h2>Supabase credentials not injected</h2>
        <p>Please ensure the environment provides __SUPABASE_URL__ and __SUPABASE_ANON_KEY__.</p>
      </div>
    </div>
  `;
  console.error('Supabase init failed:', err);
}

// DOM Elements
const loadingEl = document.getElementById('loading');
const appEl = document.getElementById('app');
const authSection = document.getElementById('auth');
const dashboardSection = document.getElementById('dashboard');
const authForm = document.getElementById('authForm');
const taskForm = document.getElementById('taskForm');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const signOutBtn = document.getElementById('signOut');
const authError = document.getElementById('authError');
const taskError = document.getElementById('taskError');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const taskTitleInput = document.getElementById('taskTitle');

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Fetch tasks for current user
async function loadTasks() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('app_2fab_todos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    taskList.innerHTML = '';
    if (data.length === 0) {
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    data.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-item';
      li.dataset.id = task.id;
      li.innerHTML = `
        <span class="task-text ${task.completed ? 'completed' : ''}" contenteditable="false">
          ${escapeHtml(task.title)}
        </span>
        <div class="task-actions">
          <button class="btn btn-outline toggle-btn">${task.completed ? 'Undo' : 'Done'}</button>
          <button class="btn btn-outline edit-btn">Edit</button>
          <button class="btn btn-secondary delete-btn">Delete</button>
        </div>
      `;
      taskList.appendChild(li);
    });
  } catch (err) {
    taskError.textContent = 'Failed to load tasks: ' + err.message;
  }
}

// Render app based on auth state
async function renderApp() {
  try {
    let currentUser = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      currentUser = user;
    } catch (err) {
      // SecurityError (e.g. sessionStorage access denied) → treat as no session
      console.warn('Auth check failed:', err);
    }

    if (!currentUser) {
      authSection.hidden = false;
      dashboardSection.hidden = true;
      teardownRealtime();
    } else {
      authSection.hidden = true;
      dashboardSection.hidden = false;
      await loadTasks();
      setupRealtime(supabase, () => {
        loadTasks().catch(console.error);
      });
    }
  } catch (err) {
    console.error('Render failed:', err);
  } finally {
    // Always hide loading and show app
    loadingEl.hidden = true;
    appEl.hidden = false;
    appEl.classList.add('loaded');
  }
}

// Handle auth form submission
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const action = e.submitter.value;
  const email = emailInput.value;
  const password = passwordInput.value;

  authError.textContent = '';

  try {
    if (action === 'signUp') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      authError.textContent = 'Check your email to confirm your account!';
      setTimeout(() => { authError.textContent = ''; }, 3000);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    authError.textContent = 'Authentication failed: ' + (err.message || 'Unknown error');
  }
});

// Handle task form submission
taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = taskTitleInput.value.trim();
  if (!title) return;

  taskError.textContent = '';

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('app_2fab_todos')
      .insert([{ title, user_id: user.id, completed: false }]);

    if (error) throw error;

    taskTitleInput.value = '';
    await loadTasks();
  } catch (err) {
    taskError.textContent = 'Failed to add task: ' + err.message;
  }
});

// Handle task list interactions (delegation)
taskList.addEventListener('click', async (e) => {
  const li = e.target.closest('.task-item');
  if (!li) return;

  const id = li.dataset.id;
  const textEl = li.querySelector('.task-text');
  const toggleBtn = li.querySelector('.toggle-btn');
  const editBtn = li.querySelector('.edit-btn');

  // Toggle completion
  if (e.target === toggleBtn) {
    try {
      const isCompleted = textEl.classList.contains('completed');
      const { error } = await supabase
        .from('app_2fab_todos')
        .update({ completed: !isCompleted })
        .eq('id', id);

      if (error) throw error;
      await loadTasks();
    } catch (err) {
      taskError.textContent = 'Update failed: ' + err.message;
    }
  }

  // Edit task
  if (e.target === editBtn) {
    if (textEl.isContentEditable) {
      const newText = textEl.textContent.trim();
      if (newText) {
        try {
          const { error } = await supabase
            .from('app_2fab_todos')
            .update({ title: newText })
            .eq('id', id);

          if (error) throw error;
          textEl.contentEditable = 'false';
          editBtn.textContent = 'Edit';
        } catch (err) {
          taskError.textContent = 'Save failed: ' + err.message;
          textEl.textContent = escapeHtml(textEl.dataset.original) || textEl.textContent;
        }
      } else {
        taskError.textContent = 'Task cannot be empty.';
      }
    } else {
      textEl.dataset.original = textEl.textContent;
      textEl.contentEditable = 'true';
      textEl.focus();
      editBtn.textContent = 'Save';
    }
  }

  // Delete task
  if (e.target.classList.contains('delete-btn')) {
    if (confirm('Delete this task?')) {
      try {
        const { error } = await supabase
          .from('app_2fab_todos')
          .delete()
          .eq('id', id);

        if (error) throw error;
        await loadTasks();
      } catch (err) {
        taskError.textContent = 'Delete failed: ' + err.message;
      }
    }
  }
});

// Sign out
signOutBtn.addEventListener('click', async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await renderApp();
  } catch (err) {
    taskError.textContent = 'Sign out failed: ' + err.message;
  }
});

// Listen for auth changes
supabase?.auth.onAuthStateChange((event, session) => {
  renderApp().catch(console.error);
});

// Initial render
(async function init() {
  try {
    await renderApp();
  } catch (err) {
    console.error('Init failed:', err);
  } finally {
    loadingEl.hidden = true;
    appEl.hidden = false;
    appEl.classList.add('loaded');
  }
})();