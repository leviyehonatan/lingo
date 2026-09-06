@AGENTS.md

# How this app is supposed to teach

**Before changing scheduling, grading, card content, word ordering, or the voice
study loop — read `docs/learning/`.** Those capsules hold the method the app is
being built around, distilled from *Fluent Forever*, plus a log of which study-model
decisions are settled and which are still open. `docs/learning/method.md` also lists,
honestly, where the current implementation does not yet follow the method, so do not
assume a gap there is a bug to fix on sight.


# Project & infrastructure context

**Before touching deployment, infra, secrets, or the server — read `~/dev/infra/docs/HANDOFF.md`.** It is the master session-state handoff (server, services, domains, secrets map, deploy workflow, TODOs).

Infrastructure is GitOps-managed in the **private repo `github.com/leviyehonatan/infra`** (local clone `~/dev/infra`):
- `docs/HANDOFF.md` — primary (read first)
- `server/` — canonical server config (traefik/postgres/couchdb/lingo/tunity compose)
- `scripts/deploy.sh` — applies config changes to the server (`cd /srv/infra && ./scripts/deploy.sh`)

Secret rule of thumb (details in HANDOFF.md §5):
- runtime app secrets → edit `/srv/<stack>/.env` on the server, then `docker compose up -d --force-recreate app`
- deploy/CI secrets (VPS_HOST/VPS_USER/VPS_SSH_KEY) → GitHub repo secrets
- external tokens (Cloudflare, Fly) → local `~/dev/hungarian/.deploy/keys/`

This repo's deploy: push to `main` → `.github/workflows/deploy-lingo.yml` → GHCR → server.
