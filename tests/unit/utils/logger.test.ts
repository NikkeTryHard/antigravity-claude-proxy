/**
 * Unit tests for Logger class
 *
 * Note: This test file imports Logger directly and does NOT use the global mock
 * from tests/setup.ts since we need to test the actual Logger implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Unmock the logger module for this test file
vi.unmock("../../../src/utils/logger.js");

// Import directly after unmocking
import { Logger } from "../../../src/utils/logger.js";

describe("Logger", () => {
  let logger: Logger;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new Logger();
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("constructor", () => {
    it("initializes with debug disabled", () => {
      expect(logger.isDebugEnabled).toBe(false);
    });
  });

  describe("setDebug", () => {
    it("enables debug mode", () => {
      logger.setDebug(true);
      expect(logger.isDebugEnabled).toBe(true);
    });

    it("disables debug mode", () => {
      logger.setDebug(true);
      logger.setDebug(false);
      expect(logger.isDebugEnabled).toBe(false);
    });
  });

  describe("info", () => {
    it("logs info message with blue color and INFO tag", () => {
      logger.info("Test message");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain("[INFO]");
      expect(call).toContain("Test message");
    });

    it("logs info message with additional arguments", () => {
      logger.info("Test message", { key: "value" });
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0]).toHaveLength(2);
      expect(consoleSpy.mock.calls[0][1]).toEqual({ key: "value" });
    });
  });

  describe("success", () => {
    it("logs success message with green color and SUCCESS tag", () => {
      logger.success("Success message");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain("[SUCCESS]");
      expect(call).toContain("Success message");
    });
  });

  describe("warn", () => {
    it("logs warning message with yellow color and WARN tag", () => {
      logger.warn("Warning message");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain("[WARN]");
      expect(call).toContain("Warning message");
    });
  });

  describe("error", () => {
    it("logs error message with red color and ERROR tag", () => {
      logger.error("Error message");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain("[ERROR]");
      expect(call).toContain("Error message");
    });
  });

  describe("debug", () => {
    it("does not log when debug is disabled", () => {
      logger.setDebug(false);
      logger.debug("Debug message");
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("logs when debug is enabled", () => {
      logger.setDebug(true);
      logger.debug("Debug message");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain("[DEBUG]");
      expect(call).toContain("Debug message");
    });

    it("logs with magenta color when debug is enabled", () => {
      logger.setDebug(true);
      logger.debug("Debug message");
      const call = consoleSpy.mock.calls[0][0] as string;
      // Magenta ANSI code is \x1b[35m
      expect(call).toContain("\x1b[35m");
    });
  });

  describe("log", () => {
    it("logs raw message directly to console", () => {
      logger.log("Raw message");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0][0]).toBe("Raw message");
    });

    it("logs raw message with additional arguments", () => {
      logger.log("Raw message", 1, 2, 3);
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0]).toEqual(["Raw message", 1, 2, 3]);
    });
  });

  describe("header", () => {
    it("prints section header with formatting", () => {
      logger.header("Section Title");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain("=== Section Title ===");
    });

    it("includes bright and cyan colors", () => {
      logger.header("Section Title");
      const call = consoleSpy.mock.calls[0][0] as string;
      // Bright ANSI code is \x1b[1m
      expect(call).toContain("\x1b[1m");
      // Cyan ANSI code is \x1b[36m
      expect(call).toContain("\x1b[36m");
    });
  });

  describe("timestamp format", () => {
    it("includes ISO timestamp in log output", () => {
      logger.info("Test message");
      const call = consoleSpy.mock.calls[0][0] as string;
      // ISO timestamp pattern: YYYY-MM-DDTHH:MM:SS.sssZ
      expect(call).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });
  });

  describe("color codes", () => {
    it("uses blue for INFO", () => {
      logger.info("Test");
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain("\x1b[34m"); // Blue
    });

    it("uses green for SUCCESS", () => {
      logger.success("Test");
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain("\x1b[32m"); // Green
    });

    it("uses yellow for WARN", () => {
      logger.warn("Test");
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain("\x1b[33m"); // Yellow
    });

    it("uses red for ERROR", () => {
      logger.error("Test");
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain("\x1b[31m"); // Red
    });

    it("uses magenta for DEBUG", () => {
      logger.setDebug(true);
      logger.debug("Test");
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain("\x1b[35m"); // Magenta
    });

    it("includes reset code after tags", () => {
      logger.info("Test");
      const call = consoleSpy.mock.calls[0][0] as string;
      expect(call).toContain("\x1b[0m"); // Reset
    });
  });
});
