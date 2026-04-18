# TaskVault Test Suite

## How to Run
1. Install dependencies: `npm install vitest jsdom @testing-library/dom`
2. Run tests: `npm test`

## Test Coverage
- **app.test.js**: End-to-end user flow tests for authentication, task management, and UI state changes. Uses mocked Supabase and DOM testing.
- **api.test.js**: Tests for Supabase API interactions including RLS enforcement, data isolation, error handling, and realtime subscription setup.

## Notes
- All tests mock Supabase to avoid external dependencies.
- Focus on security: tests verify user_id filtering, XSS protection, and proper error handling.
- Realtime functionality is tested by verifying subscription filters and channel setup.