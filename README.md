# Lingo — לימוד שפות

A Hebrew (RTL) vocabulary-flashcard app for learning **Hungarian → Hebrew**, built on Next.js and Prisma. The home page lists language pairs (currently `hu-he`) and lets you drill words by CEFR level and topic using flashcards, quizzes, or typing practice — with spaced-repetition review and a daily goal.

## Features

- **Language pairs** — routed as `/[pair]` (e.g. `/hu-he`), so adding more pairs is a data change; flags already defined for en, fr, de, es, it, ru, ar, ja, ko, zh, pt and more
- **CEFR levels & topics** — A1, A2, B1, each with Hebrew-named topics and word lists in `src/data/`
- **Three study modes** — flashcards, multiple-choice quiz, and writing (type the translation)
- **Spaced repetition** — every word is tracked as `known` / `learning` / `unknown` with a `nextReview` date
- **Filters** — all / unknown / learning / known / due
- **Daily goal** — reviewed-word counts per day, persisted as `DailyRecord` (default goal 20)
- **Auth** — NextAuth v5 with Google OAuth and email/password credentials; `/study/*` routes are protected
- **Hebrew UI** — RTL layout, Hebrew metadata, i18n context in `src/i18n/`

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) · React 19 · TypeScript · Tailwind CSS 4
- [Prisma 7](https://www.prisma.io) + PostgreSQL via the `@prisma/adapter-pg` driver adapter (generated client lives in `src/generated/prisma`, gitignored)
- [NextAuth v5](https://next-auth.js.org) (beta) with the Prisma adapter

## Getting started

Requirements: Node.js 20+ (the Docker image uses 22), a PostgreSQL database.

```bash
npm install

# 1. Environment
cp .env.example .env   # or create .env with the keys below

# 2. Generate the Prisma client, create the schema, and seed demo data
npx prisma generate
npx prisma db push
npm run seed

# 3. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret used to sign auth tokens |
| `NEXTAUTH_URL` | Public URL of the app, e.g. `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Google OAuth client id (optional — credentials login works without it) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (optional) |

`.env*` files are gitignored; `.env.example` documents the keys.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | Run ESLint |
| `npm run seed` | Upsert the `hu-he` pair, levels A1–B1, topics, and words |

## Project structure

```
prisma/schema.prisma      # PostgreSQL schema: User, LanguagePair, Level, Topic, Word, WordProgress, DailyRecord…
src/app/                  # App Router: home, /[pair], /[pair]/study/[topic], /login, API routes
src/data/                 # Seed vocabulary: levelA1.ts, levelA2.ts, levelB1.ts, types.ts
src/components/           # TopicsList and other UI
src/lib/                  # prisma client, auth, API client/types, seed
src/i18n/                 # Hebrew UI context + translations
```

## Deployment

The multi-stage `Dockerfile` builds a standalone Next.js output (`next.config.ts` sets `output: "standalone"`, `prisma generate` runs at build time), so the app can run on any container platform. It needs a PostgreSQL instance and these env vars at runtime: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and optionally the Google OAuth pair. Host-specific setup notes are kept out of this repo.
