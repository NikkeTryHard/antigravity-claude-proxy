/**
 * Unit tests for Pino-based logger utility
 *
 * TDD approach: tests written first, then implementation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// We need to test the actual logger module, not the mocked one from setup.ts
vi.unmock("../../src/utils/logger-new.js");

describe("logger-new", () => {
  // Reset module state between tests
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getLogger", () => {
    it("returns a logger with info, error, warn, debug, and trace functions", async () => {
      const { getLogger } = await import("../../../src/utils/logger-new.js");
      const logger = getLogger();

      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.trace).toBe("function");
    });

    it("returns the same singleton instance on multiple calls", async () => {
      const { getLogger } = await import("../../../src/utils/logger-new.js");
      const logger1 = getLogger();
      const logger2 = getLogger();

      expect(logger1).toBe(logger2);
    });
  });

  describe("setLogLevel", () => {
    it("changes the log level of the logger", async () => {
      const { getLogger, setLogLevel } = await import("../../../src/utils/logger-new.js");
      const logger = getLogger();

      // Default level should be info
      expect(logger.level).toBe("info");

      // Change to debug
      setLogLevel("debug");
      expect(logger.level).toBe("debug");

      // Change to error
      setLogLevel("error");
      expect(logger.level).toBe("error");
    });

    it("accepts all valid log levels", async () => {
      const { getLogger, setLogLevel } = await import("../../../src/utils/logger-new.js");
      const logger = getLogger();

      const levels = ["silent", "error", "warn", "info", "debug", "trace"] as const;
      for (const level of levels) {
        setLogLevel(level);
        expect(logger.level).toBe(level);
      }
    });
  });

  describe("initLogger", () => {
    it("configures logger with custom log level", async () => {
      const { initLogger, getLogger } = await import("../../../src/utils/logger-new.js");

      initLogger({ level: "debug" });
      const logger = getLogger();

      expect(logger.level).toBe("debug");
    });

    it("configures logger with silent level", async () => {
      const { initLogger, getLogger } = await import("../../../src/utils/logger-new.js");

      initLogger({ level: "silent" });
      const logger = getLogger();

      expect(logger.level).toBe("silent");
    });

    it("reconfigures existing logger when called again", async () => {
      const { initLogger, getLogger } = await import("../../../src/utils/logger-new.js");

      initLogger({ level: "debug" });
      const logger1 = getLogger();
      expect(logger1.level).toBe("debug");

      initLogger({ level: "error" });
      const logger2 = getLogger();
      expect(logger2.level).toBe("error");

      // Should still be singleton
      expect(logger1).toBe(logger2);
    });
  });

  describe("LogLevel type", () => {
    it("exports LogLevel type with valid values", async () => {
      // This test validates the type exists by using it
      const { setLogLevel } = await import("../../../src/utils/logger-new.js");

      // These should all be valid
      setLogLevel("silent");
      setLogLevel("error");
      setLogLevel("warn");
      setLogLevel("info");
      setLogLevel("debug");
      setLogLevel("trace");

      // If we get here without TypeScript errors, the type is correct
      expect(true).toBe(true);
    });
  });
});
