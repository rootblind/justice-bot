# Conventions

This document defines the architectural conventions of the project. It exists to ensure new features are implemented consistently, to simplify onboarding and to ensure good practices and the same format across different times and stages of development.

New code must follow these conventions unless exceptions are stated in this document or in other documentation.

It assumes familiarity with the architecture described in [`ARCHITECTURE.md`]((https://github.com/rootblind/justice-bot/blob/main/docs/architecture.md).

The structure and responsibilities of project components are explained inside the context of explaining a convention, no further details are given about the architecture. Instead, it defines in details how those components should be used and how new functionality
should be implemented.
## General Principles

- Respect good practices of writing self documenting code before needing to comment it
- Prefer existing abstractions over direct library APIs
- Prefer building abstractions to wrap patterns that use multiple library APIs over using them directly
- Avoid introducing abstractions without a clear functional benefit.
- Do not duplicate infrastructure logic
- Prefer composition over inheritance
