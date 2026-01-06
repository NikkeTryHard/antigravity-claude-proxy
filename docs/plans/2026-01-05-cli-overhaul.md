# CLI Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the CLI into a modern, user-friendly interface with beautiful interactive prompts, structured logging, and superior debugging capabilities.

**Architecture:** Replace manual argument parsing with Commander.js, swap readline prompts with @clack/prompts for arrow-key selection, implement Pino-based structured logging with multiple levels and file output, and add visual polish with picocolors, boxen, and cli-table3.

**Tech Stack:** commander, @clack/prompts, picocolors, pino, pino-pretty, boxen, cli-table3

---

## Phase 1: Foundation - Install Dependencies and Create Core Utilities

### Task 1: Install New Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install production dependencies**

Run:

```bash
npm install commander @clack/prompts picocolors pino pino-pretty boxen cli-table3
```

**Step 2: Install dev dependencies for types**

Run:

```bash
npm install -D @types/boxen
```

**Step 3: Verify installation**

Run: `npm ls commander @clack/prompts picocolors pino`
Expected: All packages listed without errors

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add CLI enhancement dependencies

- commander for CLI parsing
- @clack/prompts for interactive prompts
- picocolors for terminal colors
- pino + pino-pretty for structured logging
- boxen + cli-table3 for UI elements"
```

---

### Task 2: Create New Logger Utility with Pino

**Files:**

- Create: `src/utils/logger-new.ts`
- Create: `src/utils/logger-new.test.ts`

**Step 1: Write the failing test for logger creation**

Create `src/utils/logger-new.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Logger", () => {
  describe("createLogger", () => {
    it("should create a logger with default info level", async () => {
      const { createLogger } = await import("./logger-new.js");
      const logger = createLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/logger-new.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/utils/logger-new.ts`:

```typescript
import pino from "pino";

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug" | "trace";

export interface LoggerOptions {
  level?: LogLevel;
  pretty?: boolean;
  file?: string;
}

export function createLogger(options: LoggerOptions = {}) {
  const { level = "info", pretty = true } = options;

  const transport = pretty
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined;

  return pino({
    level,
    transport,
  });
}

// Default logger instance
let defaultLogger: pino.Logger | null = null;

export function getLogger(): pino.Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger();
  }
  return defaultLogger;
}

export function setLogLevel(level: LogLevel): void {
  getLogger().level = level;
}

export function initLogger(options: LoggerOptions): pino.Logger {
  defaultLogger = createLogger(options);
  return defaultLogger;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/logger-new.test.ts`
Expected: PASS

**Step 5: Add tests for log levels**

Add to `src/utils/logger-new.test.ts`:

```typescript
describe("setLogLevel", () => {
  it("should change log level", async () => {
    const { createLogger, setLogLevel, getLogger, initLogger } = await import("./logger-new.js");
    initLogger({ level: "info", pretty: false });
    setLogLevel("debug");
    expect(getLogger().level).toBe("debug");
  });
});

describe("initLogger", () => {
  it("should initialize with custom options", async () => {
    const { initLogger, getLogger } = await import("./logger-new.js");
    initLogger({ level: "error", pretty: false });
    expect(getLogger().level).toBe("error");
  });
});
```

**Step 6: Run all logger tests**

Run: `npm test -- src/utils/logger-new.test.ts`
Expected: All PASS

**Step 7: Commit**

```bash
git add src/utils/logger-new.ts src/utils/logger-new.test.ts
git commit -m "feat: add Pino-based structured logger

- Multiple log levels: silent, error, warn, info, debug, trace
- Pretty printing with colors and timestamps
- Singleton pattern with getLogger()
- Dynamic level changes with setLogLevel()"
```

---

### Task 3: Create UI Utilities Module

**Files:**

- Create: `src/cli/ui.ts`
- Create: `src/cli/ui.test.ts`

**Step 1: Write the failing test**

Create `src/cli/ui.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("UI Utilities", () => {
  describe("banner", () => {
    it("should create a boxed banner", async () => {
      const { banner } = await import("./ui.js");
      const result = banner("Test Title", "1.0.0");
      expect(result).toContain("Test Title");
      expect(result).toContain("1.0.0");
    });
  });

  describe("colors", () => {
    it("should export color functions", async () => {
      const { colors } = await import("./ui.js");
      expect(typeof colors.success).toBe("function");
      expect(typeof colors.error).toBe("function");
      expect(typeof colors.warn).toBe("function");
      expect(typeof colors.info).toBe("function");
      expect(typeof colors.dim).toBe("function");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/cli/ui.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write implementation**

Create `src/cli/ui.ts`:

```typescript
import boxen from "boxen";
import pc from "picocolors";
import Table from "cli-table3";

// Color helpers
export const colors = {
  success: (text: string) => pc.green(text),
  error: (text: string) => pc.red(text),
  warn: (text: string) => pc.yellow(text),
  info: (text: string) => pc.blue(text),
  dim: (text: string) => pc.dim(text),
  bold: (text: string) => pc.bold(text),
  cyan: (text: string) => pc.cyan(text),
  magenta: (text: string) => pc.magenta(text),
};

// Status indicators
export const symbols = {
  success: pc.green("✓"),
  error: pc.red("✗"),
  warning: pc.yellow("⚠"),
  info: pc.blue("ℹ"),
  arrow: pc.cyan("→"),
  bullet: pc.dim("•"),
};

// Banner creator
export function banner(title: string, version: string, subtitle?: string): string {
  const content = subtitle ? `${pc.bold(pc.cyan(title))} ${pc.dim(`v${version}`)}\n${pc.dim(subtitle)}` : `${pc.bold(pc.cyan(title))} ${pc.dim(`v${version}`)}`;

  return boxen(content, {
    padding: 1,
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: "cyan",
  });
}

// Table creator for accounts
export function accountTable(
  accounts: Array<{
    email: string;
    status: "valid" | "rate-limited" | "expired" | "unknown";
    lastUsed?: Date;
  }>,
): string {
  const table = new Table({
    head: [pc.bold(""), pc.bold("Email"), pc.bold("Status"), pc.bold("Last Used")],
    style: {
      head: [],
      border: [],
    },
  });

  accounts.forEach((account, index) => {
    const statusColor = account.status === "valid" ? colors.success : account.status === "rate-limited" ? colors.warn : colors.error;

    const statusSymbol = account.status === "valid" ? symbols.success : account.status === "rate-limited" ? symbols.warning : symbols.error;

    table.push([pc.dim(`${index + 1}.`), account.email, `${statusSymbol} ${statusColor(account.status)}`, account.lastUsed ? pc.dim(account.lastUsed.toLocaleDateString()) : pc.dim("-")]);
  });

  return table.toString();
}

// Key-value display
export function keyValue(pairs: Record<string, string | number | boolean>): string {
  const maxKeyLength = Math.max(...Object.keys(pairs).map((k) => k.length));
  return Object.entries(pairs)
    .map(([key, value]) => {
      const paddedKey = key.padEnd(maxKeyLength);
      return `  ${pc.dim(paddedKey)}  ${value}`;
    })
    .join("\n");
}

// Section header
export function sectionHeader(title: string): string {
  return `\n${pc.bold(pc.cyan(title))}\n${pc.dim("─".repeat(title.length))}`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/cli/ui.test.ts`
Expected: PASS

**Step 5: Add more tests for table and helpers**

Add to `src/cli/ui.test.ts`:

```typescript
describe("accountTable", () => {
  it("should create a formatted table", async () => {
    const { accountTable } = await import("./ui.js");
    const result = accountTable([
      { email: "test@example.com", status: "valid" },
      { email: "test2@example.com", status: "rate-limited" },
    ]);
    expect(result).toContain("test@example.com");
    expect(result).toContain("test2@example.com");
  });
});

describe("sectionHeader", () => {
  it("should create a section header", async () => {
    const { sectionHeader } = await import("./ui.js");
    const result = sectionHeader("Test Section");
    expect(result).toContain("Test Section");
  });
});

describe("symbols", () => {
  it("should export status symbols", async () => {
    const { symbols } = await import("./ui.js");
    expect(symbols.success).toBeDefined();
    expect(symbols.error).toBeDefined();
    expect(symbols.warning).toBeDefined();
  });
});
```

**Step 6: Run all UI tests**

Run: `npm test -- src/cli/ui.test.ts`
Expected: All PASS

**Step 7: Commit**

```bash
git add src/cli/ui.ts src/cli/ui.test.ts
git commit -m "feat: add CLI UI utilities

- Color helpers with picocolors
- Status symbols (success, error, warning, info)
- Boxed banner creator
- Account table formatter with cli-table3
- Section headers and key-value displays"
```

---

## Phase 2: Command Line Parsing with Commander

### Task 4: Create Main CLI Entry Point with Commander

**Files:**

- Create: `src/cli/index.ts`
- Modify: `bin/cli.js`

**Step 1: Create the new CLI entry point**

Create `src/cli/index.ts`:

```typescript
import { Command } from "commander";
import { banner, colors, symbols } from "./ui.js";
import { initLogger, setLogLevel, type LogLevel } from "../utils/logger-new.js";
import { VERSION, DEFAULT_PORT } from "../constants.js";

const program = new Command();

program
  .name("antigravity-claude-proxy")
  .description("Anthropic-compatible API proxy backed by Antigravity Cloud Code")
  .version(VERSION, "-v, --version", "Show version number")
  .option("-p, --port <number>", "Port to listen on", String(DEFAULT_PORT))
  .option("--fallback", "Enable model fallback on quota exhaustion")
  .option("--debug", "Enable debug logging")
  .option("--log-level <level>", "Set log level (silent|error|warn|info|debug|trace)", "info")
  .option("--log-file <path>", "Write logs to file")
  .option("--json-logs", "Output logs as JSON (for programmatic use)")
  .option("--silent", "Suppress all output except errors")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();

    // Determine log level
    let level: LogLevel = opts.logLevel as LogLevel;
    if (opts.silent) level = "silent";
    else if (opts.debug) level = "debug";

    // Initialize logger
    initLogger({
      level,
      pretty: !opts.jsonLogs,
      file: opts.logFile,
    });
  });

// Start command (default)
program
  .command("start", { isDefault: true })
  .description("Start the proxy server")
  .action(async () => {
    console.log(banner("Antigravity Claude Proxy", VERSION, "Anthropic API Proxy"));
    // Import and run server
    const { startServer } = await import("../server.js");
    const opts = program.opts();
    await startServer({
      port: parseInt(opts.port, 10),
      fallback: opts.fallback,
    });
  });

// Accounts command group
const accounts = program.command("accounts").description("Manage proxy accounts");

accounts
  .command("add")
  .description("Add a new account via OAuth or refresh token")
  .option("--no-browser", "Headless mode (no browser)")
  .option("--refresh-token", "Add using refresh token (reads from REFRESH_TOKEN env)")
  .action(async (options) => {
    const { runAccountsAdd } = await import("./commands/accounts-add.js");
    await runAccountsAdd(options);
  });

accounts
  .command("list")
  .alias("ls")
  .description("List all configured accounts")
  .action(async () => {
    const { runAccountsList } = await import("./commands/accounts-list.js");
    await runAccountsList();
  });

accounts
  .command("remove")
  .alias("rm")
  .description("Remove accounts interactively")
  .action(async () => {
    const { runAccountsRemove } = await import("./commands/accounts-remove.js");
    await runAccountsRemove();
  });

accounts
  .command("verify")
  .description("Verify account tokens are valid")
  .action(async () => {
    const { runAccountsVerify } = await import("./commands/accounts-verify.js");
    await runAccountsVerify();
  });

accounts
  .command("clear")
  .description("Remove all accounts")
  .action(async () => {
    const { runAccountsClear } = await import("./commands/accounts-clear.js");
    await runAccountsClear();
  });

// Init command (setup wizard)
program
  .command("init")
  .description("Interactive setup wizard")
  .action(async () => {
    const { runInit } = await import("./commands/init.js");
    await runInit();
  });

export { program };

export async function run(argv: string[] = process.argv): Promise<void> {
  await program.parseAsync(argv);
}
```

**Step 2: Update bin/cli.js to use new entry point**

Modify `bin/cli.js`:

```javascript
#!/usr/bin/env node

import { run } from "../src/cli/index.js";

run().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
```

**Step 3: Create placeholder command files**

Create directory and placeholder files:

```bash
mkdir -p src/cli/commands
```

Create `src/cli/commands/accounts-add.ts`:

```typescript
import * as p from "@clack/prompts";
import { colors, symbols } from "../ui.js";

export interface AccountsAddOptions {
  browser?: boolean;
  refreshToken?: boolean;
}

export async function runAccountsAdd(options: AccountsAddOptions): Promise<void> {
  p.intro(colors.cyan("Add Account"));

  // TODO: Implement with @clack/prompts
  p.log.info("Account add flow - to be implemented");

  p.outro(colors.success("Done"));
}
```

Create `src/cli/commands/accounts-list.ts`:

```typescript
import { accountTable, colors, sectionHeader } from "../ui.js";
import { loadAccounts } from "../../account-manager/storage.js";

export async function runAccountsList(): Promise<void> {
  const accounts = await loadAccounts();

  if (accounts.length === 0) {
    console.log(colors.warn("No accounts configured."));
    console.log(colors.dim("Run: antigravity-claude-proxy accounts add"));
    return;
  }

  console.log(sectionHeader("Configured Accounts"));
  console.log(
    accountTable(
      accounts.map((acc) => ({
        email: acc.email,
        status: acc.rateLimitedUntil && acc.rateLimitedUntil > Date.now() ? ("rate-limited" as const) : ("valid" as const),
      })),
    ),
  );
  console.log();
}
```

Create `src/cli/commands/accounts-remove.ts`:

```typescript
import * as p from "@clack/prompts";
import { colors } from "../ui.js";

export async function runAccountsRemove(): Promise<void> {
  p.intro(colors.cyan("Remove Account"));

  // TODO: Implement with @clack/prompts select
  p.log.info("Account remove flow - to be implemented");

  p.outro(colors.success("Done"));
}
```

Create `src/cli/commands/accounts-verify.ts`:

```typescript
import * as p from "@clack/prompts";
import { colors } from "../ui.js";

export async function runAccountsVerify(): Promise<void> {
  p.intro(colors.cyan("Verify Accounts"));

  // TODO: Implement with spinner
  p.log.info("Account verify flow - to be implemented");

  p.outro(colors.success("Done"));
}
```

Create `src/cli/commands/accounts-clear.ts`:

```typescript
import * as p from "@clack/prompts";
import { colors } from "../ui.js";

export async function runAccountsClear(): Promise<void> {
  p.intro(colors.cyan("Clear All Accounts"));

  // TODO: Implement with confirm prompt
  p.log.info("Account clear flow - to be implemented");

  p.outro(colors.success("Done"));
}
```

Create `src/cli/commands/init.ts`:

```typescript
import * as p from "@clack/prompts";
import { colors, banner } from "../ui.js";
import { VERSION } from "../../constants.js";

export async function runInit(): Promise<void> {
  console.log(banner("Antigravity Claude Proxy", VERSION, "Setup Wizard"));

  p.intro(colors.cyan("Let's get you set up!"));

  // TODO: Implement full wizard
  p.log.info("Setup wizard - to be implemented");

  p.outro(colors.success("Setup complete!"));
}
```

**Step 4: Run the CLI to verify it works**

Run: `npx tsx src/cli/index.ts --help`
Expected: Beautiful help output with all commands listed

**Step 5: Commit**

```bash
git add src/cli/index.ts src/cli/commands/ bin/cli.js
git commit -m "feat: add Commander-based CLI with command structure

- Main CLI entry point with Commander.js
- Global options: --port, --fallback, --debug, --log-level, --log-file, --json-logs, --silent
- Command groups: start, accounts (add/list/remove/verify/clear), init
- Placeholder implementations for all commands"
```

---

## Phase 3: Interactive Prompts with @clack/prompts

### Task 5: Implement Interactive Account Add Flow

**Files:**

- Modify: `src/cli/commands/accounts-add.ts`

**Step 1: Implement full account add flow with @clack/prompts**

Replace `src/cli/commands/accounts-add.ts`:

```typescript
import * as p from "@clack/prompts";
import pc from "picocolors";
import { colors, symbols } from "../ui.js";
import { performOAuthFlow, refreshAccessToken } from "../../auth/oauth.js";
import { saveAccount, loadAccounts } from "../../account-manager/storage.js";
import { isServerRunning } from "../utils.js";

export interface AccountsAddOptions {
  browser?: boolean;
  refreshToken?: boolean;
}

export async function runAccountsAdd(options: AccountsAddOptions): Promise<void> {
  p.intro(colors.cyan("Add Account"));

  // Check if server is running
  if (await isServerRunning()) {
    p.log.error("Proxy server is running. Please stop it first (Ctrl+C) before managing accounts.");
    p.outro(colors.error("Aborted"));
    process.exit(1);
  }

  // Determine auth method
  const method = options.refreshToken
    ? "refresh-token"
    : await p.select({
        message: "How would you like to authenticate?",
        options: [
          {
            value: "oauth",
            label: "OAuth Flow",
            hint: "Opens browser for Google sign-in",
          },
          {
            value: "refresh-token",
            label: "Refresh Token",
            hint: "Paste an existing refresh token",
          },
        ],
      });

  if (p.isCancel(method)) {
    p.cancel("Cancelled");
    process.exit(0);
  }

  if (method === "refresh-token") {
    await addWithRefreshToken();
  } else {
    await addWithOAuth(options.browser !== false);
  }
}

async function addWithRefreshToken(): Promise<void> {
  // Check for env var first
  let refreshToken = process.env.REFRESH_TOKEN;

  if (!refreshToken) {
    const input = await p.text({
      message: "Enter your refresh token:",
      placeholder: "1//...",
      validate: (value) => {
        if (!value) return "Token is required";
        if (!value.startsWith("1//")) return "Token should start with 1//";
      },
    });

    if (p.isCancel(input)) {
      p.cancel("Cancelled");
      process.exit(0);
    }

    refreshToken = input;
  }

  const spinner = p.spinner();
  spinner.start("Validating token...");

  try {
    const result = await refreshAccessToken(refreshToken);
    spinner.stop("Token validated");

    // Get email from token
    const email = result.email || "unknown@email.com";

    await saveAccount({
      email,
      refreshToken,
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
    });

    p.log.success(`${symbols.success} Added account: ${pc.bold(email)}`);
    p.outro(colors.success("Account added successfully!"));
  } catch (error) {
    spinner.stop("Validation failed");
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("invalid_grant")) {
      p.log.error("Token has been revoked or expired.");
      p.log.info("Please obtain a new token through OAuth authentication.");
    } else {
      p.log.error(`Failed to validate token: ${message}`);
    }

    p.outro(colors.error("Failed to add account"));
    process.exit(1);
  }
}

async function addWithOAuth(openBrowser: boolean): Promise<void> {
  if (!openBrowser) {
    p.log.info("Running in headless mode. You'll need to open the URL manually.");
  }

  const spinner = p.spinner();
  spinner.start("Starting OAuth flow...");

  try {
    const result = await performOAuthFlow({ openBrowser });
    spinner.stop("Authentication successful");

    await saveAccount({
      email: result.email,
      refreshToken: result.refreshToken,
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
    });

    p.log.success(`${symbols.success} Added account: ${pc.bold(result.email)}`);

    const accounts = await loadAccounts();
    p.log.info(`Total accounts: ${accounts.length}`);

    p.outro(colors.success("Account added successfully!"));
  } catch (error) {
    spinner.stop("Authentication failed");
    const message = error instanceof Error ? error.message : String(error);
    p.log.error(`OAuth failed: ${message}`);
    p.outro(colors.error("Failed to add account"));
    process.exit(1);
  }
}
```

**Step 2: Create CLI utilities file**

Create `src/cli/utils.ts`:

```typescript
import net from "net";
import { DEFAULT_PORT } from "../constants.js";

export async function isServerRunning(port: number = DEFAULT_PORT): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("error", () => {
      resolve(false);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, "127.0.0.1");
  });
}
```

**Step 3: Test the add flow manually**

Run: `npx tsx src/cli/index.ts accounts add --refresh-token`
Expected: Beautiful prompt flow with spinner

**Step 4: Commit**

```bash
git add src/cli/commands/accounts-add.ts src/cli/utils.ts
git commit -m "feat: implement interactive account add with @clack/prompts

- Method selection: OAuth or refresh token
- Spinner during validation
- Error handling with helpful messages
- Server running check before account operations"
```

---

### Task 6: Implement Account Remove with Multi-Select

**Files:**

- Modify: `src/cli/commands/accounts-remove.ts`

**Step 1: Implement remove flow**

Replace `src/cli/commands/accounts-remove.ts`:

```typescript
import * as p from "@clack/prompts";
import pc from "picocolors";
import { colors, symbols } from "../ui.js";
import { loadAccounts, removeAccount } from "../../account-manager/storage.js";
import { isServerRunning } from "../utils.js";

export async function runAccountsRemove(): Promise<void> {
  p.intro(colors.cyan("Remove Accounts"));

  if (await isServerRunning()) {
    p.log.error("Proxy server is running. Please stop it first (Ctrl+C) before managing accounts.");
    p.outro(colors.error("Aborted"));
    process.exit(1);
  }

  const accounts = await loadAccounts();

  if (accounts.length === 0) {
    p.log.warn("No accounts to remove.");
    p.outro(colors.dim("Nothing to do"));
    return;
  }

  const selected = await p.multiselect({
    message: "Select accounts to remove:",
    options: accounts.map((acc, index) => ({
      value: acc.email,
      label: acc.email,
      hint: acc.rateLimitedUntil && acc.rateLimitedUntil > Date.now() ? "rate-limited" : undefined,
    })),
    required: false,
  });

  if (p.isCancel(selected)) {
    p.cancel("Cancelled");
    process.exit(0);
  }

  if (selected.length === 0) {
    p.log.info("No accounts selected.");
    p.outro(colors.dim("Nothing to do"));
    return;
  }

  const confirm = await p.confirm({
    message: `Remove ${selected.length} account(s)?`,
    initialValue: false,
  });

  if (p.isCancel(confirm) || !confirm) {
    p.cancel("Cancelled");
    process.exit(0);
  }

  const spinner = p.spinner();
  spinner.start("Removing accounts...");

  for (const email of selected) {
    await removeAccount(email);
  }

  spinner.stop("Accounts removed");

  for (const email of selected) {
    p.log.success(`${symbols.success} Removed: ${pc.bold(email)}`);
  }

  const remaining = await loadAccounts();
  p.log.info(`Remaining accounts: ${remaining.length}`);

  p.outro(colors.success("Done!"));
}
```

**Step 2: Test manually**

Run: `npx tsx src/cli/index.ts accounts remove`
Expected: Multi-select with arrow keys, confirmation prompt

**Step 3: Commit**

```bash
git add src/cli/commands/accounts-remove.ts
git commit -m "feat: implement account remove with multi-select

- Arrow-key multi-select for account removal
- Confirmation prompt before deletion
- Spinner during removal
- Summary of removed accounts"
```

---

### Task 7: Implement Account Verify with Progress

**Files:**

- Modify: `src/cli/commands/accounts-verify.ts`

**Step 1: Implement verify flow with tasks**

Replace `src/cli/commands/accounts-verify.ts`:

```typescript
import * as p from "@clack/prompts";
import pc from "picocolors";
import { colors, symbols, accountTable } from "../ui.js";
import { loadAccounts, updateAccount } from "../../account-manager/storage.js";
import { refreshAccessToken } from "../../auth/oauth.js";

interface VerifyResult {
  email: string;
  status: "valid" | "expired" | "error";
  message?: string;
}

export async function runAccountsVerify(): Promise<void> {
  p.intro(colors.cyan("Verify Accounts"));

  const accounts = await loadAccounts();

  if (accounts.length === 0) {
    p.log.warn("No accounts to verify.");
    p.outro(colors.dim("Nothing to do"));
    return;
  }

  p.log.info(`Verifying ${accounts.length} account(s)...`);

  const results: VerifyResult[] = [];

  for (const account of accounts) {
    const spinner = p.spinner();
    spinner.start(`Checking ${pc.dim(account.email)}...`);

    try {
      const result = await refreshAccessToken(account.refreshToken);

      await updateAccount(account.email, {
        accessToken: result.accessToken,
        expiresAt: result.expiresAt,
        rateLimitedUntil: undefined, // Clear rate limit on successful refresh
      });

      spinner.stop(`${symbols.success} ${account.email}`);
      results.push({ email: account.email, status: "valid" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("invalid_grant")) {
        spinner.stop(`${symbols.error} ${account.email} ${pc.dim("(expired)")}`);
        results.push({ email: account.email, status: "expired", message: "Token expired or revoked" });
      } else {
        spinner.stop(`${symbols.error} ${account.email} ${pc.dim("(error)")}`);
        results.push({ email: account.email, status: "error", message });
      }
    }
  }

  // Summary
  console.log();
  const valid = results.filter((r) => r.status === "valid").length;
  const expired = results.filter((r) => r.status === "expired").length;
  const errors = results.filter((r) => r.status === "error").length;

  console.log(
    accountTable(
      results.map((r) => ({
        email: r.email,
        status: r.status === "valid" ? "valid" : r.status === "expired" ? "expired" : "unknown",
      })),
    ),
  );

  console.log();
  p.log.info(`Valid: ${pc.green(String(valid))} | Expired: ${pc.red(String(expired))} | Errors: ${pc.yellow(String(errors))}`);

  if (expired > 0) {
    p.log.warn("Run 'accounts add' to re-authenticate expired accounts.");
  }

  p.outro(colors.success("Verification complete!"));
}
```

**Step 2: Test manually**

Run: `npx tsx src/cli/index.ts accounts verify`
Expected: Per-account spinner, color-coded results table, summary

**Step 3: Commit**

```bash
git add src/cli/commands/accounts-verify.ts
git commit -m "feat: implement account verify with progress spinners

- Per-account verification with spinner
- Token refresh and status update
- Color-coded results table
- Summary with valid/expired/error counts"
```

---

### Task 8: Implement Account Clear with Confirmation

**Files:**

- Modify: `src/cli/commands/accounts-clear.ts`

**Step 1: Implement clear flow**

Replace `src/cli/commands/accounts-clear.ts`:

```typescript
import * as p from "@clack/prompts";
import pc from "picocolors";
import { colors, symbols } from "../ui.js";
import { loadAccounts, clearAllAccounts } from "../../account-manager/storage.js";
import { isServerRunning } from "../utils.js";

export async function runAccountsClear(): Promise<void> {
  p.intro(colors.cyan("Clear All Accounts"));

  if (await isServerRunning()) {
    p.log.error("Proxy server is running. Please stop it first (Ctrl+C) before managing accounts.");
    p.outro(colors.error("Aborted"));
    process.exit(1);
  }

  const accounts = await loadAccounts();

  if (accounts.length === 0) {
    p.log.warn("No accounts to clear.");
    p.outro(colors.dim("Nothing to do"));
    return;
  }

  p.log.warn(`This will remove ${pc.bold(String(accounts.length))} account(s):`);
  for (const acc of accounts) {
    console.log(`  ${symbols.bullet} ${acc.email}`);
  }
  console.log();

  const confirm = await p.confirm({
    message: pc.red("Are you sure you want to remove ALL accounts?"),
    initialValue: false,
  });

  if (p.isCancel(confirm) || !confirm) {
    p.cancel("Cancelled");
    process.exit(0);
  }

  // Double confirmation for safety
  const doubleConfirm = await p.text({
    message: `Type ${pc.bold("DELETE")} to confirm:`,
    validate: (value) => {
      if (value !== "DELETE") return "Type DELETE to confirm";
    },
  });

  if (p.isCancel(doubleConfirm)) {
    p.cancel("Cancelled");
    process.exit(0);
  }

  const spinner = p.spinner();
  spinner.start("Clearing all accounts...");

  await clearAllAccounts();

  spinner.stop("All accounts cleared");

  p.log.success(`${symbols.success} Removed ${accounts.length} account(s)`);
  p.outro(colors.success("Done!"));
}
```

**Step 2: Add clearAllAccounts to storage if not exists**

Check `src/account-manager/storage.ts` and add if needed:

```typescript
export async function clearAllAccounts(): Promise<void> {
  await saveAccountsToFile([]);
}
```

**Step 3: Test manually**

Run: `npx tsx src/cli/index.ts accounts clear`
Expected: Warning, confirmation, double-confirm with DELETE, spinner

**Step 4: Commit**

```bash
git add src/cli/commands/accounts-clear.ts src/account-manager/storage.ts
git commit -m "feat: implement account clear with double confirmation

- Warning with account list
- Confirmation prompt
- Double confirmation (type DELETE)
- Spinner during clear operation"
```

---

### Task 9: Implement Setup Wizard (init command)

**Files:**

- Modify: `src/cli/commands/init.ts`

**Step 1: Implement full setup wizard**

Replace `src/cli/commands/init.ts`:

```typescript
import * as p from "@clack/prompts";
import pc from "picocolors";
import fs from "fs/promises";
import path from "path";
import { colors, banner, symbols, keyValue } from "../ui.js";
import { VERSION, DEFAULT_PORT, DATA_DIR } from "../../constants.js";
import { loadAccounts } from "../../account-manager/storage.js";

interface Config {
  port: number;
  fallback: boolean;
  logLevel: string;
  logFile?: string;
}

export async function runInit(): Promise<void> {
  console.log(banner("Antigravity Claude Proxy", VERSION, "Setup Wizard"));

  p.intro(colors.cyan("Let's configure your proxy server!"));

  // Step 1: Check existing accounts
  const accounts = await loadAccounts();
  if (accounts.length > 0) {
    p.log.success(`${symbols.success} Found ${accounts.length} existing account(s)`);
  } else {
    p.log.warn("No accounts configured yet.");
  }

  // Step 2: Port configuration
  const port = await p.text({
    message: "Which port should the proxy listen on?",
    placeholder: String(DEFAULT_PORT),
    defaultValue: String(DEFAULT_PORT),
    validate: (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1 || num > 65535) {
        return "Port must be between 1 and 65535";
      }
    },
  });

  if (p.isCancel(port)) {
    p.cancel("Setup cancelled");
    process.exit(0);
  }

  // Step 3: Model fallback
  const fallback = await p.confirm({
    message: "Enable model fallback on quota exhaustion?",
    initialValue: true,
  });

  if (p.isCancel(fallback)) {
    p.cancel("Setup cancelled");
    process.exit(0);
  }

  // Step 4: Log level
  const logLevel = await p.select({
    message: "Select log level:",
    options: [
      { value: "silent", label: "Silent", hint: "No output" },
      { value: "error", label: "Error", hint: "Errors only" },
      { value: "warn", label: "Warn", hint: "Warnings and errors" },
      { value: "info", label: "Info", hint: "Standard output (recommended)" },
      { value: "debug", label: "Debug", hint: "Verbose debugging" },
      { value: "trace", label: "Trace", hint: "Maximum verbosity" },
    ],
    initialValue: "info",
  });

  if (p.isCancel(logLevel)) {
    p.cancel("Setup cancelled");
    process.exit(0);
  }

  // Step 5: Log file (optional)
  const useLogFile = await p.confirm({
    message: "Write logs to a file?",
    initialValue: false,
  });

  let logFile: string | undefined;
  if (useLogFile && !p.isCancel(useLogFile)) {
    const logFilePath = await p.text({
      message: "Log file path:",
      placeholder: "proxy.log",
      defaultValue: "proxy.log",
    });

    if (!p.isCancel(logFilePath)) {
      logFile = logFilePath;
    }
  }

  // Step 6: Add accounts if none exist
  if (accounts.length === 0) {
    const addAccount = await p.confirm({
      message: "Would you like to add an account now?",
      initialValue: true,
    });

    if (!p.isCancel(addAccount) && addAccount) {
      const { runAccountsAdd } = await import("./accounts-add.js");
      await runAccountsAdd({ browser: true });
    }
  }

  // Generate config
  const config: Config = {
    port: parseInt(port, 10),
    fallback: fallback as boolean,
    logLevel: logLevel as string,
    logFile,
  };

  // Show summary
  console.log();
  p.log.step("Configuration Summary");
  console.log(
    keyValue({
      Port: config.port,
      Fallback: config.fallback ? "enabled" : "disabled",
      "Log Level": config.logLevel,
      "Log File": config.logFile || "none",
    }),
  );
  console.log();

  // Generate start command
  const startCmd = buildStartCommand(config);

  p.note(`${pc.dim("$")} ${pc.cyan(startCmd)}`, "Start the proxy with:");

  // Ask to save as npm script or alias
  const saveOption = await p.select({
    message: "How would you like to save this configuration?",
    options: [
      { value: "none", label: "Don't save", hint: "Just show the command" },
      { value: "env", label: "Create .env file", hint: "Environment variables" },
      { value: "alias", label: "Show shell alias", hint: "Copy to your shell config" },
    ],
  });

  if (!p.isCancel(saveOption)) {
    if (saveOption === "env") {
      await saveEnvFile(config);
      p.log.success(`${symbols.success} Created .env file`);
    } else if (saveOption === "alias") {
      console.log();
      p.note(`alias acp='${startCmd}'`, "Add to your shell config (~/.bashrc or ~/.zshrc):");
    }
  }

  p.outro(colors.success("Setup complete! Run the command above to start the proxy."));
}

function buildStartCommand(config: Config): string {
  const parts = ["npx antigravity-claude-proxy"];

  if (config.port !== DEFAULT_PORT) {
    parts.push(`--port ${config.port}`);
  }
  if (config.fallback) {
    parts.push("--fallback");
  }
  if (config.logLevel !== "info") {
    parts.push(`--log-level ${config.logLevel}`);
  }
  if (config.logFile) {
    parts.push(`--log-file ${config.logFile}`);
  }

  return parts.join(" ");
}

async function saveEnvFile(config: Config): Promise<void> {
  const lines = [`# Antigravity Claude Proxy Configuration`, `PORT=${config.port}`, `FALLBACK=${config.fallback}`, `LOG_LEVEL=${config.logLevel}`];

  if (config.logFile) {
    lines.push(`LOG_FILE=${config.logFile}`);
  }

  await fs.writeFile(".env", lines.join("\n") + "\n");
}
```

**Step 2: Test the wizard**

Run: `npx tsx src/cli/index.ts init`
Expected: Beautiful step-by-step wizard with all prompts

**Step 3: Commit**

```bash
git add src/cli/commands/init.ts
git commit -m "feat: implement interactive setup wizard

- Port configuration
- Model fallback toggle
- Log level selection
- Optional log file
- Account setup integration
- Configuration summary
- Save as .env or shell alias"
```

---

## Phase 4: Integrate New Logger into Server

### Task 10: Replace Old Logger with Pino Logger

**Files:**

- Modify: `src/index.ts`
- Modify: `src/server.ts`
- Rename: `src/utils/logger.ts` -> `src/utils/logger-old.ts` (keep for reference)

**Step 1: Update server.ts to use new logger**

Add imports and replace logger calls in `src/server.ts`:

```typescript
import { getLogger } from "./utils/logger-new.js";

// Replace all logger.info(), logger.error(), etc. with:
// getLogger().info(), getLogger().error(), etc.
```

**Step 2: Update index.ts startup**

Modify `src/index.ts` to use new logger and banner:

```typescript
import { initLogger, getLogger } from "./utils/logger-new.js";
import { banner } from "./cli/ui.js";
import { VERSION, DEFAULT_PORT } from "./constants.js";

// Parse args
const args = process.argv.slice(2);
const debug = args.includes("--debug") || process.env.DEBUG === "true";
const fallback = args.includes("--fallback");

// Initialize logger
initLogger({
  level: debug ? "debug" : "info",
  pretty: true,
});

const log = getLogger();

// Show banner
console.log(banner("Antigravity Claude Proxy", VERSION));

log.info({ port: DEFAULT_PORT, fallback, debug }, "Starting server...");
```

**Step 3: Update all logger imports across codebase**

Search and replace imports:

- `from "./utils/logger.js"` -> `from "./utils/logger-new.js"`
- `from "../utils/logger.js"` -> `from "../utils/logger-new.js"`

**Step 4: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/
git commit -m "refactor: migrate to Pino-based logger

- Replace custom logger with Pino
- Structured logging with metadata
- Pretty output with timestamps
- Debug mode integration"
```

---

## Phase 5: Update package.json Scripts

### Task 11: Update npm Scripts for New CLI

**Files:**

- Modify: `package.json`

**Step 1: Update scripts section**

```json
{
  "scripts": {
    "start": "tsx src/cli/index.ts start",
    "dev": "tsx --watch src/cli/index.ts start",
    "accounts": "tsx src/cli/index.ts accounts",
    "accounts:add": "tsx src/cli/index.ts accounts add",
    "accounts:list": "tsx src/cli/index.ts accounts list",
    "accounts:remove": "tsx src/cli/index.ts accounts remove",
    "accounts:verify": "tsx src/cli/index.ts accounts verify",
    "accounts:clear": "tsx src/cli/index.ts accounts clear",
    "init": "tsx src/cli/index.ts init",
    "test": "vitest run --coverage",
    "test:watch": "vitest"
  }
}
```

**Step 2: Test all commands**

Run:

```bash
npm run accounts:list
npm start -- --help
npm run init
```

Expected: All work correctly

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: update npm scripts for new CLI structure"
```

---

## Phase 6: Documentation and Cleanup

### Task 12: Update CLAUDE.md with New CLI Options

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Add new CLI documentation**

Add section to CLAUDE.md:

```markdown
## CLI Commands

### Server

\`\`\`bash
npm start # Start proxy (port 8080)
npm start -- --port 3000 # Custom port
npm start -- --fallback # Enable model fallback
npm start -- --debug # Debug logging
npm start -- --log-level trace # Maximum verbosity
npm start -- --log-file proxy.log # Log to file
npm start -- --json-logs # JSON output for parsing
\`\`\`

### Account Management

\`\`\`bash
npm run accounts:add # Interactive OAuth
npm run accounts:add -- --no-browser # Headless mode
npm run accounts:add -- --refresh-token # Use refresh token
npm run accounts:list # List accounts (aliased: accounts ls)
npm run accounts:remove # Interactive removal
npm run accounts:verify # Test all tokens
npm run accounts:clear # Remove all accounts
\`\`\`

### Setup

\`\`\`bash
npm run init # Interactive setup wizard
\`\`\`
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with new CLI commands"
```

---

### Task 13: Remove Old CLI Files

**Files:**

- Delete: `src/cli/accounts.ts` (old implementation)
- Keep: `src/utils/logger.ts` temporarily for reference

**Step 1: Remove old accounts CLI**

```bash
rm src/cli/accounts.ts
```

**Step 2: Update any remaining imports**

Search for old imports and update.

**Step 3: Run full test suite**

Run: `npm test`
Expected: All pass

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: remove old CLI implementation

- Remove legacy accounts.ts
- All functionality now in new command structure"
```

---

## Summary

| Phase | Tasks | Description                                    |
| ----- | ----- | ---------------------------------------------- |
| 1     | 1-3   | Foundation: dependencies, logger, UI utilities |
| 2     | 4     | Commander-based CLI with command structure     |
| 3     | 5-9   | Interactive prompts for all account operations |
| 4     | 10    | Server integration with new logger             |
| 5     | 11    | npm scripts update                             |
| 6     | 12-13 | Documentation and cleanup                      |

**Total: 13 tasks**

**Key improvements delivered:**

- Commander.js for proper CLI parsing with auto-generated help
- @clack/prompts for beautiful interactive UX
- Pino structured logging with multiple levels
- Spinners during async operations
- Color-coded output throughout
- Setup wizard (init command)
- Multi-select for account operations
- JSON logging option for programmatic use
