# Security Scan Report

## Critical Issues
- [realtime.js, line 9] **Insecure Realtime Filter Construction**: The `filter` string in `setupRealtime` uses direct string concatenation with `supabase.auth.getUser()?.data?.user?.id` without validation. If the user is unauthenticated, it defaults to `'unknown'`, but during race conditions or timing attacks, this could expose data. More critically, if `getUser()` returns a falsy value, the filter becomes `user_id=eq.unknown`, which is invalid and may cause silent failures or unexpected behavior.  
  **Fix**: Validate and sanitize the user ID before using it in the filter. Only subscribe if user is authenticated.

- [app.js, line 13] **Exposed Supabase Anon Key via Global Variables**: Credentials are injected via `window.__SUPABASE_URL__` and `window.__SUPABASE_ANON_KEY__`. While not hardcoded, this pattern risks exposure via XSS or client-side inspection. The anon key should not be treated as secret, but best practice is to avoid exposing it unnecessarily.  
  **Fix**: Recommend using environment injection at build time or a backend proxy in production. No direct fix in code, but added warning.

## Warnings
- [app.js, line 134] **Missing Rate Limiting on Auth Actions**: Authentication endpoints (signUp, signInWithPassword) are called directly from frontend without rate limiting, making them vulnerable to brute-force or enumeration attacks.  
  **Fix**: Add rate limiting at the API gateway or Supabase level. Not fixable in frontend code, but noted.

- [app.js, line 220] **Use of localStorage for Session (Implied by Supabase Auth)**: Supabase Auth uses localStorage by default, which is vulnerable to XSS theft.  
  **Fix**: Configure Supabase to use `cookies` with `httpOnly` flags via `supabase.createClient(url, key, { auth: { storage: customStorage } })` and a secure backend cookie handler.

- [realtime.js, line 10] **Verbose Realtime Logging**: `console.log('Realtime update:', payload)` exposes full database change payloads in client logs, potentially leaking sensitive data.  
  **Fix**: Remove or sanitize console logs in production.

## Passed Checks
- XSS Prevention: `escapeHtml` utility is correctly used when inserting user-generated task titles.
- RLS Enforcement: All queries use `.eq('user_id', user.id)` and Supabase RLS is assumed enabled (per architect-agent context).
- Input Validation: Task title is trimmed and checked for empty before insert.
- Error Handling: Generic error messages used in UI, sensitive details not exposed.
- DOM Event Delegation: Secure, no dynamic `innerHTML` with user input beyond escaped content.
- Secure Supabase Usage: `getUser()` used to enforce ownership, no raw SQL.

---