# Learning-method capsules

Self-contained notes that carry the *why* behind lingo's study mechanics, so a
new session does not have to re-derive them. Read the one that matches the work
you are about to do.

| Capsule | Read it when |
| --- | --- |
| [`method.md`](method.md) | Touching scheduling, grading, filters, card content, or word ordering. |
| [`voice-mode.md`](voice-mode.md) | Working on the speech-recognition study loop. |
| [`decisions.md`](decisions.md) | Before proposing a change to the data model or the study loop. Says what is already settled and what is still open. |

## Where this comes from

The method notes distill *Fluent Forever* by Gabriel Wyner, Harmony Books, 2014,
which the project owner picked as the reference for how lingo should teach. The
capsules are our own summary and our own design conclusions, not the book's
text. Page-level detail stays in the book; what lives here is the part that
changes what we build. Wyner learned Hungarian himself, so the book's examples
are unusually close to this app's target language.

Everything in these capsules is a claim about *learning*, not about our code.
Where the current implementation disagrees with the method, `method.md` says so
in its gap section rather than quietly pretending we already comply.

## Where the source text lives

The book itself is **not** in this repo and must not be added to it. It is
copyrighted and this repository is public. The owner's epub and a plain-text
extraction of its chapters are kept locally at `~/dev/lingo-reference/fluent-forever/`,
outside every git working tree. If a question needs detail these capsules do not
carry, read it there and fold the conclusion back into these files.

## Where to start next (written 2026-09-07)

Decisions D1–D23 are settled and shipped. Two proposals remain, both blocked on
content rather than code:

**P4 — minimal-pairs ear trainer.** The method's first stage, which we skip
entirely. Needs real recordings, not synthesis: one engine producing both
members of a pair gives them the same idiosyncrasies, so the discrimination
task is not the one the learner needs to pass. Wikimedia Commons has Hungarian
pronunciation files (~13KB each, mostly CC BY-SA). Sourcing before code.

**P3 — example sentences.** The method's own next step after single words, for
925 words. Writing or sourcing, then a card type to show them on.

**Generated data.** `src/data/frequency.ts` is generated, not hand-edited. After
adding vocabulary, re-run
`npx tsx --tsconfig tsconfig.json scripts/build-frequency.ts` (it fetches the
source list; pass a local path to work offline). The source list itself is
deliberately not in this repo.

**Working state.** `DATABASE_URL=… npm run dev` signs you in by itself. The
deploy never runs migrations: after merging a PR that adds one, run the
**Init DB** workflow (Actions tab). CI runs e2e once per tree. Read
`~/dev/infra/docs/HANDOFF.md` before touching the server.
