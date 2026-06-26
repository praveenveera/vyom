# ADR-007: Model Abstraction Layer — engine never calls providers directly

## Status
Accepted

## Context
VYOM supports multiple AI providers and must add new ones without modifying the engine.

## Decision
All AI calls must go through ModelRouter. The engine only knows unified request/response types. Provider translation is handled entirely by model plugins.

## Consequences
**Positive:** New provider = new plugin only, centralised cost tracking, easy to test.
**Negative:** Extra abstraction layer, plugin authors must implement translation correctly.

## Alternatives Considered
- Direct provider calls in engine — every new provider requires engine changes. Rejected.
