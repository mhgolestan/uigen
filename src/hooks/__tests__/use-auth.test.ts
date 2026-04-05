import { renderHook, act } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signUp: (...args: unknown[]) => mockSignUp(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

import { useAuth } from "@/hooks/use-auth";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" });
});

describe("useAuth — initial state", () => {
  test("isLoading starts as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

describe("signIn", () => {
  test("calls signIn action with email and password", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(() => result.current.signIn("user@example.com", "password123"));

    expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "password123");
  });

  test("returns the action result on success", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    const response = await act(() =>
      result.current.signIn("user@example.com", "password123")
    );

    expect(response).toEqual({ success: true });
  });

  test("returns the action result on failure", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });
    const { result } = renderHook(() => useAuth());

    const response = await act(() =>
      result.current.signIn("user@example.com", "wrong")
    );

    expect(response).toEqual({ success: false, error: "Invalid credentials" });
  });

  test("isLoading is true during the request and false after", async () => {
    let resolveSignIn!: (v: unknown) => void;
    mockSignIn.mockReturnValue(new Promise((r) => (resolveSignIn = r)));

    const { result } = renderHook(() => useAuth());

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.signIn("user@example.com", "password123");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignIn({ success: true });
      await promise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("isLoading resets to false even when the action throws", async () => {
    mockSignIn.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useAuth());

    await expect(
      act(() => result.current.signIn("user@example.com", "password123"))
    ).rejects.toThrow("network error");

    expect(result.current.isLoading).toBe(false);
  });

  test("does not navigate when sign-in fails", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });
    const { result } = renderHook(() => useAuth());

    await act(() => result.current.signIn("user@example.com", "wrong"));

    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("signUp", () => {
  test("calls signUp action with email and password", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(() => result.current.signUp("new@example.com", "password123"));

    expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "password123");
  });

  test("returns the action result on success", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    const response = await act(() =>
      result.current.signUp("new@example.com", "password123")
    );

    expect(response).toEqual({ success: true });
  });

  test("returns the action result on failure", async () => {
    mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });
    const { result } = renderHook(() => useAuth());

    const response = await act(() =>
      result.current.signUp("existing@example.com", "password123")
    );

    expect(response).toEqual({ success: false, error: "Email already registered" });
  });

  test("isLoading resets to false even when the action throws", async () => {
    mockSignUp.mockRejectedValue(new Error("server error"));
    const { result } = renderHook(() => useAuth());

    await expect(
      act(() => result.current.signUp("new@example.com", "password123"))
    ).rejects.toThrow("server error");

    expect(result.current.isLoading).toBe(false);
  });
});

describe("post-sign-in navigation", () => {
  test("promotes anon work and navigates to the new project when anon messages exist", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: { "/": {} },
    });
    mockCreateProject.mockResolvedValue({ id: "promoted-project" });

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("user@example.com", "password123"));

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "hello" }],
        data: { "/": {} },
      })
    );
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/promoted-project");
    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  test("skips anon promotion when anon data exists but messages are empty", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockGetProjects.mockResolvedValue([{ id: "existing-project" }]);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("user@example.com", "password123"));

    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing-project");
  });

  test("navigates to the most recent existing project when no anon work", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([
      { id: "recent-project" },
      { id: "older-project" },
    ]);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("user@example.com", "password123"));

    expect(mockPush).toHaveBeenCalledWith("/recent-project");
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  test("creates a new project and navigates when user has no existing projects", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new-project" });

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signIn("user@example.com", "password123"));

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
  });

  test("signUp also triggers post-sign-in navigation on success", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "project-after-signup" }]);

    const { result } = renderHook(() => useAuth());
    await act(() => result.current.signUp("new@example.com", "password123"));

    expect(mockPush).toHaveBeenCalledWith("/project-after-signup");
  });
});
