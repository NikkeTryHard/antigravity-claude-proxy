/**
 * Logger Utility
 *
 * Provides structured logging with colors and debug support.
 * Simple ANSI codes used to avoid dependencies.
 */

const COLORS = {
  RESET: "\x1b[0m",
  BRIGHT: "\x1b[1m",
  DIM: "\x1b[2m",

  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  MAGENTA: "\x1b[35m",
  CYAN: "\x1b[36m",
  WHITE: "\x1b[37m",
  GRAY: "\x1b[90m",
} as const;

class Logger {
  isDebugEnabled: boolean;

  constructor() {
    this.isDebugEnabled = false;
  }

  /**
   * Set debug mode
   */
  setDebug(enabled: boolean): void {
    this.isDebugEnabled = enabled;
  }

  /**
   * Get current timestamp string
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Format and print a log message
   */
  private print(level: string, color: string, message: string, ...args: unknown[]): void {
    // Format: [TIMESTAMP] [LEVEL] Message
    const timestamp = `${COLORS.GRAY}[${this.getTimestamp()}]${COLORS.RESET}`;
    const levelTag = `${color}[${level}]${COLORS.RESET}`;

    console.log(`${timestamp} ${levelTag} ${message}`, ...args);
  }

  /**
   * Standard info log
   */
  info(message: string, ...args: unknown[]): void {
    this.print("INFO", COLORS.BLUE, message, ...args);
  }

  /**
   * Success log
   */
  success(message: string, ...args: unknown[]): void {
    this.print("SUCCESS", COLORS.GREEN, message, ...args);
  }

  /**
   * Warning log
   */
  warn(message: string, ...args: unknown[]): void {
    this.print("WARN", COLORS.YELLOW, message, ...args);
  }

  /**
   * Error log
   */
  error(message: string, ...args: unknown[]): void {
    this.print("ERROR", COLORS.RED, message, ...args);
  }

  /**
   * Debug log - only prints if debug mode is enabled
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.isDebugEnabled) {
      this.print("DEBUG", COLORS.MAGENTA, message, ...args);
    }
  }

  /**
   * Direct log (for raw output usually) - proxied to console.log but can be enhanced
   */
  log(message: string, ...args: unknown[]): void {
    console.log(message, ...args);
  }

  /**
   * Print a section header
   */
  header(title: string): void {
    console.log(`\n${COLORS.BRIGHT}${COLORS.CYAN}=== ${title} ===${COLORS.RESET}\n`);
  }
}

// Export a singleton instance
export const logger = new Logger();

// Export class if needed for multiple instances
export { Logger };
