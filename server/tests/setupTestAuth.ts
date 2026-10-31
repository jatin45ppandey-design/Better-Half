import { enableTestAuth } from '../src/middleware/auth.js';
import { beforeEach } from 'vitest';

// Automatically inject default test mock verifier for Vitest test runs
enableTestAuth();

beforeEach(() => {
  enableTestAuth();
});

