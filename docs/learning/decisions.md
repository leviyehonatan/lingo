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

## Landed

### D2 — The account chip, and a spoken-answer matcher that is not a substring test (2026-09-06)

Two items from the top of the list, shipped together.

The root layout renders an account chip that names the signed-in user and offers
a way out, replacing a state where the only signal a session existed was that
the study page did not redirect, and where signing out was impossible without
clearing cookies. It reads the session on the server, so no client-side session
provider was added, and it uses initials rather than the provider's avatar so no
remote image has to load.

Answer grading moved into `src/lib/answer-match.ts`. See the matching section of
[`voice-mode.md`](voice-mode.md) for what it accepts and what is still missing.

### D3 — The study screen is a guided session (2026-09-06)

The old screen showed fifteen controls at once and never said which of them the
moment called for. It is now three screens with one job each, driven by a pure
machine in `src/lib/session.ts`.

- **Setup** states the direction in words rather than arrows, how many words sit
  in each group, and which activity is about to run. A session is a fixed number
  of cards, so it ends.
- **Asking** shows one task line, the card, and only the controls that stage
  needs. Grading appears after the answer does.
- **The verdict** names what was recorded and when the word comes back, so the
  schedule stops being invisible.
- **The summary** counts what was answered and when the soonest word returns.

Two things came out of building it. Grading in quiz and writing was attributed
to whatever card the outer deck was on rather than the word being answered; all
three activities now share one machine, so an answer can only land on the word
that was asked. And overturning a verdict used to write a second review, which
marched the word up its interval ladder for one answer, so `PUT
/api/progress/:wordId` gained a `correction` flag that re-grades the review
already counted.

Reset moved off the filter row, where it sat one unconfirmed click from wiping
every word, and now asks first.

The Hebrew translation table in `src/i18n/` was already written and unused. The
session screens use it, so the interface is one language again.

### D4 — Speaking drives the session (2026-09-06)

The two microphone buttons appeared only after the answer was revealed and were
wired to nothing: a correct or wrong utterance flashed a tick and vanished, with
no progress written and no schedule moved. Before that they wrote silently, and
in quiz mode against a different word than the one on screen.

Speaking is now how a learner demonstrates knowledge. The card offers the graded
utterance, optional pronunciation practice, and an explicit admission that asks
for the answer, each labelled with what it costs. See the action table in
[`voice-mode.md`](voice-mode.md).

Pronunciation attempts are kept for the session and counted in the summary, but
are **not persisted**. There is nowhere to put them: `WordProgress` holds a
status, a next review and a count. Persisting them belongs with D1, the
per-direction schema change, and should be done in the same pass.

Speech recognition exists only in Chrome and Edge, so the spoken path is
optional and the self-grading path is the fallback. The e2e suite says which
path each spec is testing, and drives a fake recognizer rather than a
microphone.

### D5 — Teach before testing, and one path instead of a matrix (2026-09-06)

Two complaints, one cause: the session asked learners to produce words they had
never seen, and made them assemble their own sitting out of direction, group and
activity before it would start.

**A word with no progress row is taught, not tested.** It appears with its
answer, with pronunciation practice offered, and a button that says it has been
met. Meeting it schedules it as something being learned, and it is requeued to
the end of the same sitting as a question, because meeting a word without ever
being asked for it teaches nothing.

**The setup screen offers one sitting.** `src/lib/plan.ts` builds it: everything
due, oldest first, then a few new words, capped. The learner reads one line
saying what it contains and presses one button. Direction, group and activity
still exist, behind a disclosure, and choosing a group overrides the plan while
keeping the teach-versus-test rule.

The caps are the tap the method warns about: new cards are what generate
tomorrow's reviews, so a sitting introduces at most a handful.

This also surfaced a bug: with quiz or writing selected, a word being met for
the first time was asked as a multiple-choice question. Teaching now overrides
the activity, since there is nothing to answer with yet.

Meeting a word ends on its own confirmation rather than the review verdict. The
verdict named a grade and offered to correct it, which makes no sense for
something the learner was never asked. It now says the word was added and that
it will come back before the round ends.

The app also says the Hungarian aloud when the card appears, whenever the
Hungarian is on screen: always while teaching, and on the prompt side of a
forward review. Ears before mouth, as the method puts it, and it never plays a
side the learner is supposed to be recalling.

### D6 — Hands-free, and a miss is not a failure (2026-09-06)

Three corrections to the spoken path, all from watching it used.

**A misheard answer no longer fails the card.** Recognition is unreliable enough
that a miss is not evidence of forgetting, so nothing is recorded: the card says
what it heard and waits for another go, or for the learner to say whether they
knew it. Silence is treated the same way.

**Teaching asks for a repetition.** Reading a word aloud and letting the learner
click past it teaches nothing, so the microphone is the primary action on a new
word and a good repetition is what moves it on.

**Hands-free mode.** The app speaks, waits, listens and advances on its own. See
[`voice-mode.md`](voice-mode.md).

The grade buttons were also relabelled. They were named after the internal
statuses, so a learner had to think in the app's vocabulary to answer a question
about their own memory; they now read as the answer to the question asked.

### D7 — A sitting's shape is fixed before it starts (2026-09-06)

Every word met today is asked for later in the same sitting. That queue is now
built when the sitting starts rather than growing as the learner goes, so the
counter stops climbing under them and the length is known up front. The sitting
is counted in words, since a new word simply appears twice.

The confirmation after meeting a word shows the pair once more, and hands-free
holds it longer than a review verdict, because that panel is the last look at
the meaning before the word is asked for.

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

### P8 — Persist pronunciation attempts

Counted per session today, forgotten afterwards. Needs somewhere to live; see
D4 and D1.

### P7 — Enforce the recall window

The method gives a review five to ten seconds. Nothing counts that down yet, and
nothing ends a card the learner is staring at. This is the next piece of the
guided session, and the natural place for the voice loop to attach.
