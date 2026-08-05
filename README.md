<p align="center">
  <h1 align="center">Alloo</h1>
  <p align="center"><strong>Juste discuter. Rien d'autre.</strong></p>
  <p align="center">
    <a href="#features">Features</a> ·
    <a href="#getting-started">Getting Started</a> ·
    <a href="#testing">Testing</a> ·
    <a href="#contributing">Contributing</a> ·
    <a href="#license">License</a>
  </p>
</p>

---

Alloo is a minimalist, real-time chat application that runs in your browser.
Private messages and groups — nothing more, nothing less.

> **Status:** pre-launch. The app runs locally against a Convex dev deployment;
> nothing is hosted yet, so there is no public URL.

## Why Alloo?

- **Discord** drowns you in channels, bots, and features you never asked for.
- **Telegram** adds stickers, stories, and mini-apps every month.
- **WhatsApp** is stuck on your phone.
- **Slack** is work. Nobody wants Slack after 6pm.

Alloo does one thing — messaging — and does it well.

## Features

**Messaging**

- Real-time delivery through Convex reactive queries, with paginated history
- Direct messages and groups (up to 100 members)
- Replies, pins, emoji reactions, per-user "delete for me"
- Typing indicators, read receipts, online presence
- On-device translation of a message, where the browser supports it
  (Chrome/Edge `Translator` API)

**Groups**

- Admin and member roles; a group always keeps at least one admin
- Invite links and QR codes, with an expiry date and admin rotation
- System messages stored structurally, so the timeline stays translatable

**Calls**

- 1:1 audio and video over WebRTC, with perfect negotiation
- Signaling over Convex; TURN credentials minted server-side

**Interface**

- French UI, light and dark themes
- Responsive from phone to desktop
- Installable as a PWA (web app manifest and icons)

Not there yet: offline support (no service worker), end-to-end encryption,
group calls, file attachments, message search, notifications.

## Tech Stack

| Layer            | Technology                              |
| ---------------- | --------------------------------------- |
| Runtime          | Bun                                     |
| Monorepo         | Turborepo + Bun workspaces              |
| Language         | TypeScript                              |
| Framework        | Next.js 16 (App Router, React Compiler) |
| Backend          | Convex                                  |
| Auth             | Convex Auth (password, Google, GitHub)  |
| UI               | shadcn/base-ui + Tailwind CSS v4        |
| Animations       | Framer Motion                           |
| Client state     | Zustand                                 |
| Lint and format  | Biome                                   |
| Unit tests       | Vitest + convex-test                    |
| End-to-end tests | Playwright                              |
| Git hooks        | Husky + lint-staged + commitlint        |
| CI               | GitHub Actions                          |

## Project Structure

```
alloo/
├── apps/
│   ├── app/          # Chat application (Next.js + Convex)
│   │   ├── convex/   # Schema, queries, mutations, actions — and their tests
│   │   └── src/      # Routes, components, hooks, client helpers
│   └── landing/      # Landing page (Next.js, static)
├── e2e/              # Playwright specs, covering both apps
├── biome.json        # Lint and format, whole repo
├── turbo.json        # Task graph
└── playwright.config.ts
```

`packages/` is declared as a workspace but does not exist yet — add it when
something is genuinely shared between the two apps.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) 1.2 or newer
- A [Convex](https://convex.dev/) account

### Installation

```bash
git clone https://github.com/lucasschimmel/alloo.git
cd alloo
bun install
```

`bun install` also installs the Git hooks through Husky.

### Configuration

```bash
cp apps/app/.env.example apps/app/.env.local
cp apps/landing/.env.example apps/landing/.env.local
```

Then start the Convex dev deployment, which fills in `NEXT_PUBLIC_CONVEX_URL`
and `CONVEX_DEPLOYMENT` for you:

```bash
bun run --cwd apps/app convex
```

Calls fall back to STUN-only without a TURN relay, which fails behind symmetric
NAT. See the deployment variables documented in `apps/app/.env.example`.

### Running

```bash
bun run dev
```

The chat app serves on <http://localhost:3000>, the landing page on
<http://localhost:3001>.

## Scripts

Run from the repository root.

| Command                | What it does                                        |
| ---------------------- | --------------------------------------------------- |
| `bun run dev`          | Both apps in watch mode                             |
| `bun run build`        | Production build of both apps                       |
| `bun run lint`         | Biome check (lint + format) across the repo         |
| `bun run lint:fix`     | Same, applying every safe fix                       |
| `bun run typecheck`    | `tsc --noEmit` on the root config and both apps     |
| `bun run test`         | Vitest — unit and Convex function tests             |
| `bun run test:e2e`     | Playwright — builds both apps, then drives them     |
| `bun run test:e2e:ui`  | Playwright in interactive mode                      |
| `bun run verify`       | lint + typecheck + test + build, in that order      |

## Testing

Three layers, each runnable on its own:

**Convex functions** — `apps/app/convex/*.test.ts` run against
[`convex-test`](https://docs.convex.dev/functions/testing), an in-memory
implementation of the backend. They cover the parts where a mistake is
expensive: authentication, group permissions, invite expiry, admin succession,
rate limits, read cursors and the call state machine. No deployment needed.

**Pure helpers** — `apps/app/src/lib/*.test.ts` cover the client-side logic that
has no I/O: the call state machine, time formatting, system-message wording.

**End-to-end** — `e2e/*.spec.ts` drive real production builds of both apps in
Chromium, desktop and mobile viewports. Because the suite runs without a Convex
deployment, it covers what renders before any backend round-trip: the whole
landing page, the app's public auth routes, and the PWA manifest. Signed-in
flows are left to the Convex function tests.

```bash
bun run --cwd apps/app test           # unit + Convex
bun run --cwd apps/app test:coverage  # same, with thresholds enforced
bun run test:e2e                      # Playwright
```

Coverage is measured on business logic only — the Convex functions and the pure
client helpers. Framework wiring, the Node-only TURN action and the browser-only
WebRTC and audio modules are excluded; the thresholds live in
`apps/app/vitest.config.mts`.

## Quality Gates

- **Biome** lints and formats every JS, TS and JSON file. CSS is excluded: Biome
  cannot yet parse the Tailwind v4 at-rules used in `globals.css`.
- **Husky** runs Biome on staged files before a commit, checks the commit
  message against Conventional Commits, and runs typecheck plus unit tests
  before a push.
- **GitHub Actions** runs lint, typecheck, unit tests with coverage, both
  builds, and the Playwright suite on every push and pull request to `main` and
  `develop`.

To bypass a hook in an emergency, `git commit --no-verify` — CI will still catch
whatever the hook would have.

## Contributing

### Branch Convention (Gitflow)

- `main` — production-ready code
- `develop` — integration branch for features
- `feature/*` — new features (`feature/real-time-chat`)
- `fix/*` — bug fixes (`fix/message-scroll`)
- `hotfix/*` — urgent production fixes

### Workflow

1. Fork the repository
2. Create your branch from `develop` (`git checkout -b feature/my-feature develop`)
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/) —
   the `commit-msg` hook enforces it
4. Push to your fork
5. Open a pull request against `develop`

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file
for details.

---

<p align="center">
  Built with care by <a href="https://github.com/lucasschimmel">lucasschimmel</a>
</p>
