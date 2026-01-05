#!/usr/bin/env node

/**
 * Account Management CLI
 *
 * Interactive CLI for adding and managing Google accounts
 * for the Antigravity Claude Proxy.
 *
 * Usage:
 *   node src/cli/accounts.js          # Interactive mode
 *   node src/cli/accounts.js add      # Add new account(s)
 *   node src/cli/accounts.js list     # List all accounts
 *   node src/cli/accounts.js clear    # Remove all accounts
 */

import { createInterface, type Interface as ReadlineInterface } from "readline/promises";
import { stdin, stdout } from "process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { exec } from "child_process";
import net from "net";
import { ACCOUNT_CONFIG_PATH, DEFAULT_PORT, MAX_ACCOUNTS } from "../constants.js";
import { getAuthorizationUrl, startCallbackServer, completeOAuthFlow, refreshAccessToken, getUserEmail, extractCodeFromInput, validateRefreshToken } from "../auth/oauth.js";

const SERVER_PORT = Number(process.env.PORT ?? DEFAULT_PORT);

/**
 * Model rate limit state
 */
interface ModelRateLimit {
  isRateLimited: boolean;
  resetTime: number;
}

/**
 * Account data structure
 */
interface Account {
  email: string;
  refreshToken: string;
  projectId?: string | null;
  addedAt?: string;
  lastUsed?: number | null;
  modelRateLimits?: Record<string, ModelRateLimit>;
}

/**
 * Account configuration file structure
 */
interface AccountConfig {
  accounts: Account[];
  settings: {
    cooldownDurationMs?: number;
    maxRetries?: number;
    [key: string]: unknown;
  };
  activeIndex: number;
}

/**
 * Check if the Antigravity Proxy server is running
 * Returns true if port is occupied
 */
function isServerRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true); // Server is running
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(false); // Port free
    });

    socket.connect(SERVER_PORT, "localhost");
  });
}

/**
 * Enforce that server is stopped before proceeding
 */
async function ensureServerStopped(): Promise<void> {
  const isRunning = await isServerRunning();
  if (isRunning) {
    console.error(`
\x1b[31mError: Antigravity Proxy server is currently running on port ${SERVER_PORT}.\x1b[0m

Please stop the server (Ctrl+C) before adding or managing accounts.
This ensures that your account changes are loaded correctly when you restart the server.
`);
    process.exit(1);
  }
}

/**
 * Create readline interface
 */
function createRL(): ReadlineInterface {
  return createInterface({ input: stdin, output: stdout });
}

/**
 * Open URL in default browser
 */
function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;

  if (platform === "darwin") {
    command = `open "${url}"`;
  } else if (platform === "win32") {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.log("\nCould not open browser automatically.");
      console.log("Please open this URL manually:", url);
    }
  });
}

/**
 * Load existing accounts from config
 */
function loadAccounts(): Account[] {
  try {
    if (existsSync(ACCOUNT_CONFIG_PATH)) {
      const data = readFileSync(ACCOUNT_CONFIG_PATH, "utf-8");
      const config = JSON.parse(data) as AccountConfig;
      return config.accounts ?? [];
    }
  } catch (error) {
    console.error("Error loading accounts:", (error as Error).message);
  }
  return [];
}

/**
 * Save accounts to config
 */
function saveAccounts(accounts: Account[], settings: Record<string, unknown> = {}): void {
  try {
    const dir = dirname(ACCOUNT_CONFIG_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const config: AccountConfig = {
      accounts: accounts.map((acc) => ({
        email: acc.email,
        source: "oauth",
        refreshToken: acc.refreshToken,
        projectId: acc.projectId,
        addedAt: acc.addedAt ?? new Date().toISOString(),
        lastUsed: acc.lastUsed ?? null,
        modelRateLimits: acc.modelRateLimits ?? {},
      })) as Account[],
      settings: {
        cooldownDurationMs: 60000,
        maxRetries: 5,
        ...settings,
      },
      activeIndex: 0,
    };

    writeFileSync(ACCOUNT_CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`\nSaved ${accounts.length} account(s) to ${ACCOUNT_CONFIG_PATH}`);
  } catch (error) {
    console.error("Error saving accounts:", (error as Error).message);
    throw error;
  }
}

/**
 * Display current accounts
 */
function displayAccounts(accounts: Account[]): void {
  if (accounts.length === 0) {
    console.log("\nNo accounts configured.");
    return;
  }

  console.log(`\n${accounts.length} account(s) saved:`);
  accounts.forEach((acc, i) => {
    // Check for any active model-specific rate limits
    const hasActiveLimit = Object.values(acc.modelRateLimits ?? {}).some((limit) => limit.isRateLimited && limit.resetTime > Date.now());
    const status = hasActiveLimit ? " (rate-limited)" : "";
    console.log(`  ${i + 1}. ${acc.email}${status}`);
  });
}

/**
 * Add a new account via OAuth with automatic callback
 */
async function addAccount(existingAccounts: Account[]): Promise<Account | null> {
  console.log("\n=== Add Google Account ===\n");

  // Generate authorization URL
  const { url, verifier, state } = getAuthorizationUrl();

  console.log("Opening browser for Google sign-in...");
  console.log("(If browser does not open, copy this URL manually)\n");
  console.log(`   ${url}\n`);

  // Open browser
  openBrowser(url);

  // Start callback server and wait for code
  console.log("Waiting for authentication (timeout: 2 minutes)...\n");

  try {
    const code = await startCallbackServer(state);

    console.log("Received authorization code. Exchanging for tokens...");
    const result = await completeOAuthFlow(code, verifier);

    // Check if account already exists
    const existing = existingAccounts.find((a) => a.email === result.email);
    if (existing) {
      console.log(`\nAccount ${result.email} already exists. Updating tokens.`);
      existing.refreshToken = result.refreshToken;
      existing.projectId = result.projectId;
      existing.addedAt = new Date().toISOString();
      return null; // Don't add duplicate
    }

    console.log(`\nSuccessfully authenticated: ${result.email}`);
    if (result.projectId) {
      console.log(`  Project ID: ${result.projectId}`);
    }

    return {
      email: result.email,
      refreshToken: result.refreshToken,
      projectId: result.projectId,
      addedAt: new Date().toISOString(),
      modelRateLimits: {},
    };
  } catch (error) {
    console.error(`\nAuthentication failed: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Add a new account via OAuth with manual code input (no-browser mode)
 * For headless servers without a desktop environment
 */
async function addAccountNoBrowser(existingAccounts: Account[], rl: ReadlineInterface): Promise<Account | null> {
  console.log("\n=== Add Google Account (No-Browser Mode) ===\n");

  // Generate authorization URL
  const { url, verifier, state } = getAuthorizationUrl();

  console.log("Copy the following URL and open it in a browser on another device:\n");
  console.log(`   ${url}\n`);
  console.log("After signing in, you will be redirected to a localhost URL.");
  console.log("Copy the ENTIRE redirect URL or just the authorization code.\n");

  const input = await rl.question("Paste the callback URL or authorization code: ");

  try {
    const { code, state: extractedState } = extractCodeFromInput(input);

    // Validate state if present
    if (extractedState && extractedState !== state) {
      console.log("\nState mismatch detected. This could indicate a security issue.");
      console.log("Proceeding anyway as this is manual mode...");
    }

    console.log("\nExchanging authorization code for tokens...");
    const result = await completeOAuthFlow(code, verifier);

    // Check if account already exists
    const existing = existingAccounts.find((a) => a.email === result.email);
    if (existing) {
      console.log(`\nAccount ${result.email} already exists. Updating tokens.`);
      existing.refreshToken = result.refreshToken;
      existing.projectId = result.projectId;
      existing.addedAt = new Date().toISOString();
      return null; // Don't add duplicate
    }

    console.log(`\nSuccessfully authenticated: ${result.email}`);
    if (result.projectId) {
      console.log(`  Project ID: ${result.projectId}`);
    }

    return {
      email: result.email,
      refreshToken: result.refreshToken,
      projectId: result.projectId,
      addedAt: new Date().toISOString(),
      modelRateLimits: {},
    };
  } catch (error) {
    console.error(`\nAuthentication failed: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Add a new account using only a refresh token
 *
 * This allows importing accounts from other tools like:
 * - Gemini CLI (~/.gemini/oauth_creds.json)
 * - opencode-antigravity-auth
 * - Other OAuth-based tools
 *
 * The refresh token is validated by exchanging it for an access token
 * and fetching the user's email and project ID.
 */
async function addAccountWithRefreshToken(existingAccounts: Account[], rl: ReadlineInterface): Promise<Account | null> {
  console.log("\n=== Add Account with Refresh Token ===\n");

  console.log("This allows you to add an account using only a refresh token.");
  console.log("You can get refresh tokens from:\n");
  console.log("  - Gemini CLI: ~/.gemini/oauth_creds.json (refresh_token field)");
  console.log("  - opencode-antigravity-auth: ~/.config/opencode/");
  console.log("  - Other OAuth flows with Google Cloud Platform scopes\n");
  console.log("Note: Refresh tokens typically start with '1//' for Google OAuth.\n");

  // Check for token in environment variable first
  let token = process.env.REFRESH_TOKEN;

  if (token) {
    console.log("Using refresh token from REFRESH_TOKEN environment variable...\n");
  } else {
    token = await rl.question("Paste your refresh token: ");
  }

  if (!token || token.trim().length === 0) {
    console.log("\nNo token provided.");
    return null;
  }

  try {
    console.log("\nValidating refresh token...");
    const result = await validateRefreshToken(token);

    // Check if account already exists
    const existing = existingAccounts.find((a) => a.email === result.email);
    if (existing) {
      console.log(`\nAccount ${result.email} already exists. Updating tokens.`);
      existing.refreshToken = result.refreshToken;
      existing.projectId = result.projectId;
      existing.addedAt = new Date().toISOString();
      return null; // Don't add duplicate
    }

    console.log(`\nSuccessfully validated: ${result.email}`);
    if (result.projectId) {
      console.log(`  Project ID: ${result.projectId}`);
    }

    return {
      email: result.email,
      refreshToken: result.refreshToken,
      projectId: result.projectId,
      addedAt: new Date().toISOString(),
      modelRateLimits: {},
    };
  } catch (error) {
    console.error(`\nToken validation failed: ${(error as Error).message}`);

    // Provide helpful error messages
    if ((error as Error).message.includes("invalid_grant")) {
      console.log("\nThe refresh token has been revoked or expired.");
      console.log("Please obtain a new token through OAuth authentication.");
    } else if ((error as Error).message.includes("invalid_client")) {
      console.log("\nThe token was created with a different OAuth client.");
      console.log("Try using the standard OAuth flow instead: npm run accounts:add");
    }

    return null;
  }
}

/**
 * Interactive remove accounts flow
 */
async function interactiveRemove(rl: ReadlineInterface): Promise<void> {
  while (true) {
    const accounts = loadAccounts();
    if (accounts.length === 0) {
      console.log("\nNo accounts to remove.");
      return;
    }

    displayAccounts(accounts);
    console.log("\nEnter account number to remove (or 0 to cancel)");

    const answer = await rl.question("> ");
    const index = parseInt(answer, 10);

    if (isNaN(index) || index < 0 || index > accounts.length) {
      console.log("\nInvalid selection.");
      continue;
    }

    if (index === 0) {
      return; // Exit
    }

    const removed = accounts[index - 1]; // 1-based to 0-based
    const confirm = await rl.question(`\nAre you sure you want to remove ${removed.email}? [y/N]: `);

    if (confirm.toLowerCase() === "y") {
      accounts.splice(index - 1, 1);
      saveAccounts(accounts);
      console.log(`\nRemoved ${removed.email}`);
    } else {
      console.log("\nCancelled.");
    }

    const removeMore = await rl.question("\nRemove another account? [y/N]: ");
    if (removeMore.toLowerCase() !== "y") {
      break;
    }
  }
}

/**
 * Options for interactive add
 */
interface InteractiveAddOptions {
  noBrowser?: boolean;
  refreshToken?: boolean;
}

/**
 * Interactive add accounts flow (Main Menu)
 */
async function interactiveAdd(rl: ReadlineInterface, options: InteractiveAddOptions = {}): Promise<void> {
  const { noBrowser = false, refreshToken = false } = options;

  if (refreshToken) {
    console.log("\nRefresh token mode: Add account using a refresh token.\n");
  } else if (noBrowser) {
    console.log("\nNo-browser mode: You will manually paste the authorization code.\n");
  }

  const accounts = loadAccounts();

  if (accounts.length > 0) {
    displayAccounts(accounts);

    const choice = await rl.question("\n(a)dd new, (r)emove existing, (f)resh start, or (e)xit? [a/r/f/e]: ");
    const c = choice.toLowerCase();

    if (c === "r") {
      await interactiveRemove(rl);
      return; // Return to main or exit? Given this is "add", we probably exit after sub-task.
    } else if (c === "f") {
      console.log("\nStarting fresh - existing accounts will be replaced.");
      accounts.length = 0;
    } else if (c === "a") {
      console.log("\nAdding to existing accounts.");
    } else if (c === "e") {
      console.log("\nExiting...");
      return; // Exit cleanly
    } else {
      console.log("\nInvalid choice, defaulting to add.");
    }
  }

  // Add single account
  if (accounts.length >= MAX_ACCOUNTS) {
    console.log(`\nMaximum of ${MAX_ACCOUNTS} accounts reached.`);
    return;
  }

  // Use appropriate add function based on mode
  let newAccount: Account | null;
  if (refreshToken) {
    newAccount = await addAccountWithRefreshToken(accounts, rl);
  } else if (noBrowser) {
    newAccount = await addAccountNoBrowser(accounts, rl);
  } else {
    newAccount = await addAccount(accounts);
  }

  if (newAccount) {
    accounts.push(newAccount);
    saveAccounts(accounts);
  } else if (accounts.length > 0) {
    // Even if newAccount is null (duplicate update), save the updated accounts
    saveAccounts(accounts);
  }

  if (accounts.length > 0) {
    displayAccounts(accounts);
    console.log("\nTo add more accounts, run this command again.");
  } else {
    console.log("\nNo accounts to save.");
  }
}

/**
 * List accounts
 */
function listAccounts(): void {
  const accounts = loadAccounts();
  displayAccounts(accounts);

  if (accounts.length > 0) {
    console.log(`\nConfig file: ${ACCOUNT_CONFIG_PATH}`);
  }
}

/**
 * Clear all accounts
 */
async function clearAccounts(rl: ReadlineInterface): Promise<void> {
  const accounts = loadAccounts();

  if (accounts.length === 0) {
    console.log("No accounts to clear.");
    return;
  }

  displayAccounts(accounts);

  const confirm = await rl.question("\nAre you sure you want to remove all accounts? [y/N]: ");
  if (confirm.toLowerCase() === "y") {
    saveAccounts([]);
    console.log("All accounts removed.");
  } else {
    console.log("Cancelled.");
  }
}

/**
 * Verify accounts (test refresh tokens)
 */
async function verifyAccounts(): Promise<void> {
  const accounts = loadAccounts();

  if (accounts.length === 0) {
    console.log("No accounts to verify.");
    return;
  }

  console.log("\nVerifying accounts...\n");

  for (const account of accounts) {
    try {
      const tokens = await refreshAccessToken(account.refreshToken);
      const email = await getUserEmail(tokens.accessToken);
      console.log(`  OK: ${email}`);
    } catch (error) {
      console.log(`  FAILED: ${account.email} - ${(error as Error).message}`);
    }
  }
}

/**
 * Main CLI
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? "add";
  const noBrowser = args.includes("--no-browser");
  const refreshToken = args.includes("--refresh-token");

  console.log("============================================");
  console.log("   Antigravity Proxy Account Manager        ");
  console.log("   --no-browser     Headless mode           ");
  console.log("   --refresh-token  Add with refresh token  ");
  console.log("============================================");

  const rl = createRL();

  try {
    switch (command) {
      case "add":
        await ensureServerStopped();
        await interactiveAdd(rl, { noBrowser, refreshToken });
        break;
      case "list":
        listAccounts();
        break;
      case "clear":
        await ensureServerStopped();
        await clearAccounts(rl);
        break;
      case "verify":
        await verifyAccounts();
        break;
      case "help":
        console.log("\nUsage:");
        console.log("  node src/cli/accounts.js add     Add new account(s)");
        console.log("  node src/cli/accounts.js list    List all accounts");
        console.log("  node src/cli/accounts.js verify  Verify account tokens");
        console.log("  node src/cli/accounts.js clear   Remove all accounts");
        console.log("  node src/cli/accounts.js help    Show this help");
        console.log("\nOptions:");
        console.log("  --no-browser      Manual authorization code input (for headless servers)");
        console.log("  --refresh-token   Add account using only a refresh token");
        console.log("\nEnvironment Variables:");
        console.log("  REFRESH_TOKEN     When using --refresh-token, read token from this variable");
        console.log("\nExamples:");
        console.log("  npm run accounts:add                      # Standard OAuth flow");
        console.log("  npm run accounts:add -- --no-browser      # Manual code input");
        console.log("  npm run accounts:add -- --refresh-token   # Use refresh token directly");
        console.log("  REFRESH_TOKEN=xxx npm run accounts:add -- --refresh-token  # From env var");
        console.log("\nRefresh Token Sources:");
        console.log("  - Gemini CLI: ~/.gemini/oauth_creds.json (refresh_token field)");
        console.log("  - opencode-antigravity-auth: ~/.config/opencode/");
        break;
      case "remove":
        await ensureServerStopped();
        await interactiveRemove(rl);
        break;
      default:
        console.log(`Unknown command: ${command}`);
        console.log('Run with "help" for usage information.');
    }
  } finally {
    rl.close();
    // Force exit to prevent hanging
    process.exit(0);
  }
}

main().catch(console.error);
