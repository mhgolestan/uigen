import { test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MainContent } from "../main-content";

// Mock contexts
vi.mock("@/lib/contexts/file-system-context", () => ({
  FileSystemProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useFileSystem: vi.fn().mockReturnValue({
    fileSystem: null,
    refreshTrigger: 0,
    selectedFile: null,
    setSelectedFile: vi.fn(),
    handleToolCall: vi.fn(),
    getAllFiles: vi.fn().mockReturnValue(new Map()),
  }),
}));

vi.mock("@/lib/contexts/chat-context", () => ({
  ChatProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useChat: vi.fn().mockReturnValue({
    messages: [],
    input: "",
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
    stop: vi.fn(),
  }),
}));

// Mock heavy sub-components
vi.mock("@/components/chat/ChatInterface", () => ({
  ChatInterface: () => <div data-testid="chat-interface">Chat</div>,
}));

vi.mock("@/components/editor/FileTree", () => ({
  FileTree: () => <div data-testid="file-tree">File Tree</div>,
}));

vi.mock("@/components/editor/CodeEditor", () => ({
  CodeEditor: () => <div data-testid="code-editor">Code Editor</div>,
}));

vi.mock("@/components/preview/PreviewFrame", () => ({
  PreviewFrame: () => <div data-testid="preview-frame">Preview</div>,
}));

vi.mock("@/components/HeaderActions", () => ({
  HeaderActions: () => <div data-testid="header-actions">Actions</div>,
}));

// Mock resizable panels
vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children, className }: any) => (
    <div className={className} data-testid="resizable-panel-group">
      {children}
    </div>
  ),
  ResizablePanel: ({ children }: any) => <div>{children}</div>,
  ResizableHandle: () => <div data-testid="resizable-handle" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("Preview tab is active by default and shows preview frame", async () => {
  render(<MainContent />);

  expect(screen.getByTestId("preview-frame")).toBeDefined();
  expect(screen.queryByTestId("code-editor")).toBeNull();
});

test("Clicking Code tab switches to code view", async () => {
  const user = userEvent.setup();
  render(<MainContent />);

  const codeButton = screen.getByRole("button", { name: "Code" });
  await user.click(codeButton);

  expect(screen.queryByTestId("preview-frame")).toBeNull();
  expect(screen.getByTestId("code-editor")).toBeDefined();
  expect(screen.getByTestId("file-tree")).toBeDefined();
});

test("Clicking Preview tab switches back to preview view", async () => {
  const user = userEvent.setup();
  render(<MainContent />);

  // First switch to code view
  const codeButton = screen.getByRole("button", { name: "Code" });
  await user.click(codeButton);
  expect(screen.getByTestId("code-editor")).toBeDefined();

  // Then switch back to preview
  const previewButton = screen.getByRole("button", { name: "Preview" });
  await user.click(previewButton);

  expect(screen.getByTestId("preview-frame")).toBeDefined();
  expect(screen.queryByTestId("code-editor")).toBeNull();
});

test("Toggle buttons alternate between views correctly", async () => {
  const user = userEvent.setup();
  render(<MainContent />);

  const previewButton = screen.getByRole("button", { name: "Preview" });
  const codeButton = screen.getByRole("button", { name: "Code" });

  // Start: preview is shown
  expect(screen.getByTestId("preview-frame")).toBeDefined();

  // Click Code → code view
  await user.click(codeButton);
  expect(screen.queryByTestId("preview-frame")).toBeNull();
  expect(screen.getByTestId("code-editor")).toBeDefined();

  // Click Preview → preview view
  await user.click(previewButton);
  expect(screen.getByTestId("preview-frame")).toBeDefined();
  expect(screen.queryByTestId("code-editor")).toBeNull();

  // Click Code again → code view
  await user.click(codeButton);
  expect(screen.queryByTestId("preview-frame")).toBeNull();
  expect(screen.getByTestId("code-editor")).toBeDefined();
});
