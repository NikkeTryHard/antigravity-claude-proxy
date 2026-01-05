/**
 * Global Test Setup
 *
 * Configures common mocks and cleanup for all tests.
 */

import { vi, beforeEach, afterEach } from "vitest";

// Suppress logger output in all tests
vi.mock("../src/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    log: vi.fn(),
    header: vi.fn(),
    setDebug: vi.fn(),
    isDebugEnabled: false,
  },
  Logger: vi.fn(),
}));

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Ensure real timers are restored after each test
afterEach(() => {
  vi.useRealTimers();
});
