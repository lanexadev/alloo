# @alloo/app

The Alloo chat application: Next.js front end plus the Convex backend it talks
to. Setup, scripts and testing are documented in the
[repository README](../../README.md) — run everything from the repository root.

```
convex/    Schema, queries, mutations and actions, with their tests alongside
src/app/   Routes (auth, chat, invite) — App Router
src/       components/ hooks/ lib/ providers/
```

Convex skips any file in `convex/` whose name contains more than one dot, which
is why the tests (`*.test.ts`) and their helpers (`test.setup.ts`) live next to
the functions without ever being deployed.
