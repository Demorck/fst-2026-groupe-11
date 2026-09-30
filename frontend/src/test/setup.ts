import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// vitest globals are off so testing-library can't register its own cleanup
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
