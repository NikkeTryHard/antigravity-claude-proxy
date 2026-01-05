/**
 * Tests for src/auth/oauth.ts
 * Google OAuth with PKCE for Antigravity
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAuthorizationUrl, extractCodeFromInput, exchangeCode, refreshAccessToken, getUserEmail, discoverProjectId, completeOAuthFlow, validateRefreshToken, startCallbackServer } from "../../../src/auth/oauth.js";
import { OAUTH_CONFIG, OAUTH_REDIRECT_URI } from "../../../src/constants.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("auth/oauth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getAuthorizationUrl", () => {
    it("returns a valid authorization URL with PKCE parameters", () => {
      const result = getAuthorizationUrl();

      expect(result.url).toContain(OAUTH_CONFIG.authUrl);
      expect(result.url).toContain("client_id=");
      expect(result.url).toContain("redirect_uri=");
      expect(result.url).toContain("response_type=code");
      expect(result.url).toContain("code_challenge=");
      expect(result.url).toContain("code_challenge_method=S256");
      expect(result.url).toContain("access_type=offline");
      expect(result.url).toContain("prompt=consent");
      expect(result.url).toContain("state=");
    });

    it("returns a PKCE verifier", () => {
      const result = getAuthorizationUrl();

      expect(result.verifier).toBeDefined();
      expect(typeof result.verifier).toBe("string");
      expect(result.verifier.length).toBeGreaterThan(20);
    });

    it("returns a state parameter", () => {
      const result = getAuthorizationUrl();

      expect(result.state).toBeDefined();
      expect(typeof result.state).toBe("string");
      expect(result.state.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it("generates unique verifiers on each call", () => {
      const result1 = getAuthorizationUrl();
      const result2 = getAuthorizationUrl();

      expect(result1.verifier).not.toBe(result2.verifier);
      expect(result1.state).not.toBe(result2.state);
    });

    it("includes all required OAuth scopes", () => {
      const result = getAuthorizationUrl();
      const url = new URL(result.url);
      const scope = url.searchParams.get("scope");

      expect(scope).toBeDefined();
      OAUTH_CONFIG.scopes.forEach((s) => {
        expect(scope).toContain(s);
      });
    });

    it("uses correct redirect URI", () => {
      const result = getAuthorizationUrl();
      const url = new URL(result.url);

      expect(url.searchParams.get("redirect_uri")).toBe(OAUTH_REDIRECT_URI);
    });
  });

  describe("extractCodeFromInput", () => {
    it("extracts code from full callback URL", () => {
      const input = "http://localhost:51121/oauth-callback?code=4/0ABC123&state=xyz789";

      const result = extractCodeFromInput(input);

      expect(result.code).toBe("4/0ABC123");
      expect(result.state).toBe("xyz789");
    });

    it("extracts code from HTTPS callback URL", () => {
      const input = "https://example.com/callback?code=4/0DEF456&state=abc123";

      const result = extractCodeFromInput(input);

      expect(result.code).toBe("4/0DEF456");
      expect(result.state).toBe("abc123");
    });

    it("handles URL without state parameter", () => {
      const input = "http://localhost:51121/oauth-callback?code=4/0GHI789";

      const result = extractCodeFromInput(input);

      expect(result.code).toBe("4/0GHI789");
      expect(result.state).toBeNull();
    });

    it("handles raw authorization code input", () => {
      const input = "4/0ABCDEFGHIJKLMNOP1234567890";

      const result = extractCodeFromInput(input);

      expect(result.code).toBe("4/0ABCDEFGHIJKLMNOP1234567890");
      expect(result.state).toBeNull();
    });

    it("trims whitespace from input", () => {
      const input = "  4/0ABCDEFGHIJKLMNOP1234567890  \n";

      const result = extractCodeFromInput(input);

      expect(result.code).toBe("4/0ABCDEFGHIJKLMNOP1234567890");
    });

    it("throws on empty input", () => {
      expect(() => extractCodeFromInput("")).toThrow("No input provided");
    });

    it("throws on null input", () => {
      expect(() => extractCodeFromInput(null as unknown as string)).toThrow("No input provided");
    });

    it("throws on undefined input", () => {
      expect(() => extractCodeFromInput(undefined as unknown as string)).toThrow("No input provided");
    });

    it("throws on OAuth error in URL", () => {
      const input = "http://localhost:51121/oauth-callback?error=access_denied";

      expect(() => extractCodeFromInput(input)).toThrow("OAuth error: access_denied");
    });

    it("throws when URL has no code parameter", () => {
      const input = "http://localhost:51121/oauth-callback?state=xyz";

      expect(() => extractCodeFromInput(input)).toThrow("No authorization code found in URL");
    });

    it("throws on invalid URL format", () => {
      const input = "http://[invalid-url";

      expect(() => extractCodeFromInput(input)).toThrow("Invalid URL format");
    });

    it("throws on too short raw code", () => {
      const input = "abc123";

      expect(() => extractCodeFromInput(input)).toThrow("Input is too short to be a valid authorization code");
    });

    it("accepts minimum length raw code (10 chars)", () => {
      const input = "1234567890";

      const result = extractCodeFromInput(input);

      expect(result.code).toBe("1234567890");
    });
  });

  describe("exchangeCode", () => {
    it("exchanges authorization code for tokens successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "access-token-123",
            refresh_token: "refresh-token-456",
            expires_in: 3600,
          }),
      });

      const result = await exchangeCode("auth-code-123", "verifier-xyz");

      expect(result).toEqual({
        accessToken: "access-token-123",
        refreshToken: "refresh-token-456",
        expiresIn: 3600,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        OAUTH_CONFIG.tokenUrl,
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }),
      );
    });

    it("includes all required parameters in request body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "token",
            refresh_token: "refresh",
            expires_in: 3600,
          }),
      });

      await exchangeCode("my-code", "my-verifier");

      const call = mockFetch.mock.calls[0];
      const body = call[1].body as URLSearchParams;

      expect(body.get("code")).toBe("my-code");
      expect(body.get("code_verifier")).toBe("my-verifier");
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("client_id")).toBe(OAUTH_CONFIG.clientId);
      expect(body.get("client_secret")).toBe(OAUTH_CONFIG.clientSecret);
      expect(body.get("redirect_uri")).toBe(OAUTH_REDIRECT_URI);
    });

    it("throws on failed token exchange", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("invalid_grant"),
      });

      await expect(exchangeCode("bad-code", "verifier")).rejects.toThrow("Token exchange failed: invalid_grant");
    });

    it("throws when no access token in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ refresh_token: "refresh" }),
      });

      await expect(exchangeCode("code", "verifier")).rejects.toThrow("No access token received");
    });

    it("handles missing refresh token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "access-token",
            expires_in: 3600,
          }),
      });

      const result = await exchangeCode("code", "verifier");

      expect(result.refreshToken).toBe("");
    });
  });

  describe("refreshAccessToken", () => {
    it("refreshes access token successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access-token",
            expires_in: 3600,
          }),
      });

      const result = await refreshAccessToken("refresh-token-123");

      expect(result).toEqual({
        accessToken: "new-access-token",
        expiresIn: 3600,
      });
    });

    it("sends correct refresh token request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "token",
            expires_in: 3600,
          }),
      });

      await refreshAccessToken("my-refresh-token");

      const call = mockFetch.mock.calls[0];
      const body = call[1].body as URLSearchParams;

      expect(body.get("refresh_token")).toBe("my-refresh-token");
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("client_id")).toBe(OAUTH_CONFIG.clientId);
      expect(body.get("client_secret")).toBe(OAUTH_CONFIG.clientSecret);
    });

    it("throws on failed refresh", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve("invalid_grant - token revoked"),
      });

      await expect(refreshAccessToken("bad-token")).rejects.toThrow("Token refresh failed: invalid_grant - token revoked");
    });
  });

  describe("getUserEmail", () => {
    it("fetches user email from access token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            email: "user@example.com",
            name: "Test User",
          }),
      });

      const result = await getUserEmail("access-token-123");

      expect(result).toBe("user@example.com");
      expect(mockFetch).toHaveBeenCalledWith(OAUTH_CONFIG.userInfoUrl, {
        headers: { Authorization: "Bearer access-token-123" },
      });
    });

    it("throws on failed user info fetch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      await expect(getUserEmail("bad-token")).rejects.toThrow("Failed to get user info: 401");
    });
  });

  describe("discoverProjectId", () => {
    it("discovers project ID from API response (string format)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            cloudaicompanionProject: "project-123",
          }),
      });

      const result = await discoverProjectId("access-token");

      expect(result).toBe("project-123");
    });

    it("discovers project ID from API response (object format)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            cloudaicompanionProject: { id: "project-456" },
          }),
      });

      const result = await discoverProjectId("access-token");

      expect(result).toBe("project-456");
    });

    it("returns null when project ID not in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await discoverProjectId("access-token");

      expect(result).toBeNull();
    });

    it("tries fallback endpoints on failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ cloudaicompanionProject: "fallback-project" }),
      });

      const result = await discoverProjectId("access-token");

      expect(result).toBe("fallback-project");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("returns null when all endpoints fail", async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const result = await discoverProjectId("access-token");

      expect(result).toBeNull();
    });

    it("handles network errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await discoverProjectId("access-token");

      expect(result).toBeNull();
    });
  });

  describe("completeOAuthFlow", () => {
    it("completes full OAuth flow and returns account info", async () => {
      // Mock exchangeCode
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 3600,
          }),
      });

      // Mock getUserEmail
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ email: "user@example.com" }),
      });

      // Mock discoverProjectId
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ cloudaicompanionProject: "project-id" }),
      });

      const result = await completeOAuthFlow("auth-code", "verifier");

      expect(result).toEqual({
        email: "user@example.com",
        refreshToken: "refresh-token",
        accessToken: "access-token",
        projectId: "project-id",
      });
    });

    it("returns null projectId when discovery fails", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "access",
              refresh_token: "refresh",
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ email: "test@test.com" }),
        })
        .mockResolvedValue({ ok: false });

      const result = await completeOAuthFlow("code", "verifier");

      expect(result.projectId).toBeNull();
      expect(result.email).toBe("test@test.com");
    });
  });

  describe("validateRefreshToken", () => {
    it("validates refresh token and returns account info", async () => {
      // Mock refreshAccessToken
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "access-token", expires_in: 3600 }),
      });

      // Mock getUserEmail
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ email: "validated@example.com" }),
      });

      // Mock discoverProjectId
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ cloudaicompanionProject: "discovered-project" }),
      });

      const result = await validateRefreshToken("1//valid-refresh-token");

      expect(result).toEqual({
        email: "validated@example.com",
        refreshToken: "1//valid-refresh-token",
        accessToken: "access-token",
        projectId: "discovered-project",
      });
    });

    it("trims whitespace from refresh token", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "token", expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ email: "test@test.com" }),
        })
        .mockResolvedValue({ ok: false });

      const result = await validateRefreshToken("  1//token-with-spaces  ");

      expect(result.refreshToken).toBe("1//token-with-spaces");
    });

    it("throws on empty refresh token", async () => {
      await expect(validateRefreshToken("")).rejects.toThrow("Refresh token is required");
    });

    it("throws on null refresh token", async () => {
      await expect(validateRefreshToken(null as unknown as string)).rejects.toThrow("Refresh token is required");
    });

    it("throws on too short refresh token", async () => {
      await expect(validateRefreshToken("short")).rejects.toThrow("Invalid refresh token format - token is too short");
    });

    it("throws when refresh fails (invalid token)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve("invalid_grant"),
      });

      await expect(validateRefreshToken("1//invalid-refresh-token")).rejects.toThrow("Token refresh failed");
    });
  });

  describe("startCallbackServer", () => {
    it("is a function that returns a promise", () => {
      expect(typeof startCallbackServer).toBe("function");
      // We don't actually start the server in tests as it would bind to a port
    });

    // Note: Full integration tests for startCallbackServer would require
    // actually starting an HTTP server and making requests to it.
    // These are better suited for integration tests.
  });
});
