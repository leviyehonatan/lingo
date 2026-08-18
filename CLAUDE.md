@AGENTS.md

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
