# ADR-001: Engine implemented in TypeScript on Node.js

## Status
Accepted

## Context
The GarageBuild engine needs to run cross-platform (macOS, Windows, Linux), support a rich plugin ecosystem, and share language with the plugins themselves.

## Decision
The engine will be implemented in TypeScript on Node.js LTS.

## Consequences
**Positive:** Same language as plugins, huge npm ecosystem, strong typing, cross-platform, easy REST/IPC exposure.
**Negative:** Single-threaded, CPU-intensive tasks need worker threads.

## Alternatives Considered
- Rust — better performance but steep learning curve, no shared language with plugins
- Python — great AI ecosystem but slower startup, poor desktop integration
- Go — fast but no shared language with plugins
