# Study-model decisions

What is settled, what is proposed, and what each one costs. Add to the log
rather than rewriting history. Dates are the day the call was made.

## Accepted

### D1 — Progress is tracked per direction (2026-09-06)

Recognizing a word and producing it are different skills, and the method treats
them as separate cards with separate schedules. One status per word cannot
represent "I understand it when I hear it but cannot say it," which is exactly
the state a voice-first app puts a learner in.

`WordProgress` gains a direction, and its unique key becomes user plus word plus
direction instead of user plus word.

**No data migration.** The app is not in production and has no real user
progress worth preserving. Decided by the project owner on 2026-09-06.

Implementation notes for whoever picks this up:

- Production applies schema changes with `prisma migrate deploy` from the
  `migrate` service in `deploy/docker-compose.yml`, so a migration file is still
  required. What is *not* required is any backfill step: give the column a
  default, or reset development databases and reseed.
- Local and CI databases can simply be reset. CI pushes the schema directly and
  the e2e global setup reseeds, so nothing there needs hand-holding.
- The progress API payload carries the direction, and the client keys its status
  lookups by word and direction together.
- The existing e2e specs assume one progress row per word after one answer.
  They will need updating, and that update is part of the change, not a
  follow-up.

## Proposed, not yet decided

### P1 — Pass or fail with a reset, instead of a three-way status

The method grades a review as pass or fail, and a fail returns the card to the
shortest interval. We store `known`, `learning` and `unknown` and never reset.
Adopting this touches `src/lib/progress.ts`, the API contract and the filter UI,
so it is a real change rather than a rename.

### P2 — Ladder position from a streak, not from total review count

`reviewInterval` indexes the ladder by how many times a word has ever been
reviewed. A word answered correctly many times, then failed, jumps straight back
to a long interval on its next pass. Position should come from the current run
of successes. This is arguably a bug against the intent of the existing code and
could be fixed on its own, ahead of any larger redesign.

### P3 — Cards carry meaning, not a translation

Audio, an image and a phonetic transcription on the `Word` model, so a card can
stop being a pair of strings. This is the largest item on the list. It needs
content, not just schema, and it is what most of the method's advantage rests
on.

### P4 — A minimal-pairs ear trainer before vocabulary

The method's first stage, which we skip entirely. Needs audio assets. See the
ear-training section of [`voice-mode.md`](voice-mode.md).

### P5 — Frequency-based ordering, and breaking up thematic sets

Our words are grouped by topic, which puts easily confused items in the same
session. The method orders by frequency and deliberately scatters related words.
This is a data change to `src/data`, plus a way to order a deck that is not
topic order.

### P6 — Measure accuracy

We cannot currently tell whether reviews are landing in the 90 to 95 percent
band the schedule assumes. Without it, every interval-tuning discussion is
guesswork.

### P7 — Show who is signed in, and allow signing out

Unrelated to the method, but open: the app has no account UI at all, so the only
signal that a session exists is that the study page did not redirect, and there
is no way to sign out. The root layout is a server component and can read the
session directly.
