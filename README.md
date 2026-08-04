<p align="center">
  <h1 align="center">Alloo</h1>
  <p align="center"><strong>Juste discuter. Rien d'autre.</strong></p>
  <p align="center">
    <a href="https://alloo.app">Website</a> ·
    <a href="#features">Features</a> ·
    <a href="#getting-started">Getting Started</a> ·
    <a href="#contributing">Contributing</a> ·
    <a href="#license">License</a>
  </p>
</p>

---

Alloo is a minimalist, real-time chat application that runs entirely in your browser. Private messages and groups — nothing more, nothing less.

## Why Alloo?

- **Discord** drowns you in channels, bots, and features you never asked for.
- **Telegram** adds stickers, stories, and mini-apps every month.
- **WhatsApp** is stuck on your phone.
- **Slack** is work. Nobody wants Slack after 6pm.

Alloo does one thing — messaging — and does it well.

## Features

- **Real-time messaging** — Instant delivery via reactive queries
- **Private messages** — 1-to-1 conversations
- **Groups** — Create a group, share a link or QR code, done
- **Light-first UI** — Clean, modern, and bright by default. Dark mode available
- **Browser-native** — Same URL on desktop and mobile. No download required (PWA)
- **Privacy-first** — No tracking, no ads, no data selling

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Language | TypeScript |
| Framework | Next.js (App Router) |
| Backend | Convex |
| Auth | Convex Auth |
| UI | shadcn/ui + Tailwind CSS v4 |
| Animations | Framer Motion |
| Linting | BiomeJS |
| Testing | Vitest + Playwright |
| PWA | Serwist |
| Hosting | Vercel |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.1+)
- A [Convex](https://convex.dev/) account

### Installation

```bash
# Clone the repository
git clone https://github.com/lucasschimmel/alloo.git
cd alloo

# Install dependencies
bun install

# Setup environment variables
cp .env.example .env.local

# Start Convex dev server
bunx convex dev

# Start the app
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
alloo/
├── apps/
│   ├── app/          # Main chat application (Next.js)
│   └── landing/      # Landing page (Next.js)
├── packages/         # Shared packages (future)
└── turbo.json        # Turborepo config
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

### Branch Convention (Gitflow)

- `main` — Production-ready code
- `develop` — Integration branch for features
- `feature/*` — New features (`feature/real-time-chat`)
- `fix/*` — Bug fixes (`fix/message-scroll`)
- `hotfix/*` — Urgent production fixes

### Workflow

1. Fork the repository
2. Create your branch from `develop` (`git checkout -b feature/my-feature develop`)
3. Commit your changes
4. Push to your fork
5. Open a Pull Request against `develop`

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with care by <a href="https://github.com/lucasschimmel">lucasschimmel</a>
</p>
