import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { resetDialogs } from '../components/dialogs.ts';
import { resetTicketsStore } from '../features/tickets/store.ts';

// vitest globals are off so testing-library can't register its own cleanup
afterEach(() => {
  cleanup();
  resetDialogs();
  resetTicketsStore();
  localStorage.clear();
  vi.unstubAllGlobals();
});
