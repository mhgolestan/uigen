
// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { jwtVerify } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ set: mockCookieSet }),
}));

beforeEach(() => {
  mockCookieSet.mockClear();
});

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

test("createSession sets auth-token cookie with correct options", async () => {
  const { createSession } = await import("@/lib/auth");

  const before = Date.now();
  await createSession("user-123", "test@example.com");
  const after = Date.now();

  expect(mockCookieSet).toHaveBeenCalledOnce();

  const [name, , options] = mockCookieSet.mock.calls[0];
  expect(name).toBe("auth-token");
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
  expect(options.expires.getTime()).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000);
  expect(options.expires.getTime()).toBeLessThanOrEqual(after + 7 * 24 * 60 * 60 * 1000);
});

test("createSession produces a valid JWT with correct payload", async () => {
  const { createSession } = await import("@/lib/auth");

  await createSession("user-123", "test@example.com");

  const token = mockCookieSet.mock.calls[0][1];
  const { payload } = await jwtVerify(token, JWT_SECRET);

  expect(payload.userId).toBe("user-123");
  expect(payload.email).toBe("test@example.com");
  expect(typeof payload.exp).toBe("number");
});

test("createSession sets secure=true in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const { createSession } = await import("@/lib/auth");

  await createSession("user-123", "test@example.com");
  expect(mockCookieSet.mock.calls[0][2].secure).toBe(true);

  vi.unstubAllEnvs();
});

test("createSession sets secure=false outside production", async () => {
  vi.stubEnv("NODE_ENV", "test");
  const { createSession } = await import("@/lib/auth");

  await createSession("user-123", "test@example.com");
  expect(mockCookieSet.mock.calls[0][2].secure).toBe(false);

  vi.unstubAllEnvs();
});
