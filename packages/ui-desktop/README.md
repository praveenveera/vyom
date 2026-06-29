# @garagebuild/ui-desktop

Tauri 2 + React desktop application for GarageBuild. Provides a native window wrapping the same React UI as `ui-web`, with the added ability to start and stop the embedded GarageBuild server process from within the app.

## What's Different from ui-web

| Feature | ui-web | ui-desktop |
|---------|--------|------------|
| Runtime | Browser | Tauri native window |
| Server management | External (user starts separately) | Built-in via `useServer` hook + Rust backend |
| File access | Fetch API | Native Tauri file system (planned) |
| Distribution | CDN / static hosting | Platform-native installer (.dmg, .exe, .deb) |

## Architecture

```
React Frontend (src/)
  └── useServer hook ──→ Tauri invoke ──→ Rust backend (src-tauri/src/lib.rs)
                                              ├── start_server(bin_path)
                                              ├── stop_server()
                                              └── get_server_status() → bool
```

The `ServerProcess` state in Rust holds the running `Child` process. The frontend polls every 5 seconds via `get_server_status`.

## Install & Build

**Frontend (TypeScript/React):**
```bash
npm install --workspace=packages/ui-desktop
npm test --workspace=packages/ui-desktop       # 10 vitest tests, no Tauri required
npm run build --workspace=packages/ui-desktop  # type-checks + Vite build
```

**Full desktop build (requires Rust toolchain):**
```bash
# Install Rust: https://rustup.rs
npm run tauri:build --workspace=packages/ui-desktop
```

**Dev mode:**
```bash
npm run dev --workspace=packages/ui-desktop    # starts Tauri dev window
```

## Rust Backend

`src-tauri/src/lib.rs` — three Tauri commands:

| Command | Args | Returns |
|---------|------|---------|
| `start_server` | `bin_path: String` | `Result<(), String>` |
| `stop_server` | — | `Result<(), String>` |
| `get_server_status` | — | `bool` |

## Testing

The `useServer` hook is tested independently from Tauri via `vi.mock('@tauri-apps/api/core')`. All 10 tests run without a Rust build or native window.
