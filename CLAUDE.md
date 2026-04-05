# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# First-time setup
npm run setup           # installs deps, generates Prisma client, runs DB migrations

# Development
npm run dev             # Next.js dev server with Turbopack at http://localhost:3000
npm run dev:daemon      # Run dev server in background, logs to logs.txt

# Build & lint
npm run build
npm run lint

# Tests
npm test                # run all tests (Vitest)
npm test -- src/lib/__tests__/file-system.test.ts  # run a single test file

# Database
npm run db:reset        # drop and re-apply all migrations (destructive)
npx prisma migrate dev  # apply pending migrations
npx prisma studio       # open Prisma Studio UI
```

Set `ANTHROPIC_API_KEY` in `.env` to enable real AI generation. Without it, the app falls back to a mock provider that returns static code.

## Architecture

### Overview

UIGen is a Next.js 15 App Router application where users describe React components in a chat interface, and Claude generates them with live preview — no files are ever written to disk.

### Core Data Flow

1. User sends a message → `src/app/api/chat/route.ts` (POST)
2. The route reconstructs a `VirtualFileSystem` from the serialized `files` payload sent by the client
3. `streamText` (Vercel AI SDK) calls Claude with two tools: `str_replace_editor` and `file_manager`
4. Claude calls these tools to create/modify files on the server-side VFS
5. Tool call results stream back to the client
6. The client's `ChatContext` (`src/lib/contexts/chat-context.tsx`) intercepts tool calls via `handleToolCall` and mirrors the mutations on a client-side `VirtualFileSystem`
7. `FileSystemContext` triggers a `refreshTrigger` counter increment, which causes `PreviewFrame` to regenerate the preview

### Virtual File System (`src/lib/file-system.ts`)

`VirtualFileSystem` is an in-memory tree of `FileNode` objects (files and directories). It lives on both the server (per-request, reconstructed from the client payload) and the client (held in `FileSystemProvider` state). Key methods:
- `serialize()` / `deserializeFromNodes()` — round-trip through plain objects for JSON transport
- `replaceInFile()`, `insertInFile()`, `createFileWithParents()` — called by the AI tools

### Preview Pipeline (`src/lib/transform/jsx-transformer.ts`)

When the VFS changes, `PreviewFrame` calls `createImportMap(files)`:
1. Each `.jsx`/`.tsx`/`.js`/`.ts` file is transpiled client-side using `@babel/standalone`
2. Each transformed file becomes a Blob URL
3. An ES module import map is assembled that maps `@/` aliases, relative paths, and third-party packages (via `esm.sh`) to blob URLs
4. `createPreviewHTML()` builds a full HTML document with the import map, an error boundary, and a `<script type="module">` that dynamically imports `/App.jsx` as the entry point
5. This HTML is assigned to `iframe.srcdoc`

### Contexts

- **`FileSystemProvider`** (`src/lib/contexts/file-system-context.tsx`) — owns the client VFS instance, exposes `handleToolCall` which routes `str_replace_editor` and `file_manager` tool calls into VFS mutations
- **`ChatProvider`** (`src/lib/contexts/chat-context.tsx`) — wraps Vercel AI SDK's `useChat`, forwards the current VFS state in every request body, and calls `handleToolCall` for each streamed tool invocation

### AI Tools (`src/lib/tools/`)

- `str-replace.ts` — `str_replace_editor` tool: `create`, `str_replace`, `insert`, `view` commands
- `file-manager.ts` — `file_manager` tool: `rename`, `delete`, `list` commands

### Auth & Persistence

- JWT-based auth stored in an `httpOnly` cookie (7-day expiry). `src/lib/auth.ts` handles signing/verification with `jose`.
- `src/middleware.ts` verifies the cookie on protected routes.
- Anonymous users' work is tracked in `sessionStorage` via `src/lib/anon-work-tracker.ts`. On sign-up/sign-in, this data is promoted to a persisted `Project`.
- The `Project` model in `prisma/schema.prisma` stores `messages` (JSON array) and `data` (serialized VFS) as plain strings.

### Prisma / SQLite

- Schema: `prisma/schema.prisma`, client output: `src/generated/prisma/`
- Singleton client: `src/lib/prisma.ts`
- Dev database: `prisma/dev.db` (SQLite)

### Testing

Tests use Vitest + jsdom + React Testing Library. Test files live alongside source in `__tests__/` subdirectories.

## Code Style

use comments sparingly. only comment complex code

## Testing

Vitest config is in `vitest.config.mts`.

## Database

The database schema is defined in the `prisma/schema.prisma` file. Reference it anytime you need to understand the structure of data stored in the database.
