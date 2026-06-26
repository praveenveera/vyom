# ADR-004: Event Bus as sole inter-subsystem communication mechanism

## Status
Accepted

## Context
Eight engine subsystems need to react to each other's state changes without tight coupling.

## Decision
All inter-subsystem communication must go through the Event Bus. No subsystem may directly call another subsystem.

## Consequences
**Positive:** Full decoupling, easy to test, clear audit trail, new features via new listeners.
**Negative:** Harder to trace execution flow, async coordination requires care.

## Alternatives Considered
- Direct method calls — simple but tight coupling. Rejected.
- Dependency injection — better but still couples interfaces. Rejected.
- RxJS — good reactive model but heavy dependency. Rejected.
