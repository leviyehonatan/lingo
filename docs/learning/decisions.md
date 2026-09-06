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

### D8 — One spoken action per card (2026-09-06)

A review card offered two microphones: say the answer, or practise saying the
word already on screen. That asked the learner to choose what they were
practising before they could answer, and in hands-free it was ambiguous which
one the app had opened. Practising a word on screen is what meeting a word is
for, so it now lives only there, and a review card has exactly one thing to say.

An open microphone also says what it wants for as long as it is open, naming the
language and whether it expects the word or the meaning.

### D9 — Reviews are logged, not just summarised (2026-09-06)

A status column can say where a word stands and nothing about how it got there,
so the app could not tell whether a learner was improving, hesitating, or
guessing.

Every answered card now writes a `ReviewEvent`: direction, whether the word was
being met or asked for, how the answer arrived, the grade, whether it was a
correction, how long it took, and how often the learner spoke. `WordProgress`
also carries `seenCount`, which counts introductions as well as questions, and
`lapses`, the count of times a known word came back forgotten.

`GET /api/stats` reads the log and answers the questions worth asking: how many
words have been met and how many are known, how many keep slipping, the share
of answers recalled in the last month, the typical time to answer, and how many
days were practised. The setup screen shows them, with the accuracy line saying
what the method says: between 90 and 95 percent means the intervals are right,
and anything else is the schedule being wrong rather than the learner.

The log is written in the same transaction as the state it explains, and it is
deleted when a learner resets their progress, since it describes a run that no
longer exists.

Events carry the direction, which means the two directions can be told apart in
the numbers before they are scheduled apart. That is the evidence D1 was
missing.

### D10 — Hands-free recovers on its own (2026-09-06)

Hands-free stopped being hands-free the moment recognition failed: it waited
for a button. It now listens again by itself after a miss, up to three attempts
on a card, and then records the failure and moves on. One mishearing is still
not a failure; three in a row with nothing heard means the learner cannot be
heard, and the session should carry on rather than sit there listening.

## What the other apps do

Researched 2026-09-06 against Speak, Pimsleur, Rosetta Stone, Duolingo and
Babbel, so it does not need doing again. Only the parts that bear on decisions
here are kept.

- **Spacing starts inside the session.** Pimsleur's published ladder is 5s, 25s,
  2min, 10min, 1hr, 5hr, 1 day, 5 days, 25 days, 4 months, 2 years, and its
  first four rungs fire before the lesson ends. Duolingo re-queues missed items
  so a lesson cannot finish until they are right. We reinsert a newly met word
  once, at the end of the sitting, and our short rungs can never fire because
  the deck is fixed when the sitting starts.
- **A mistake resets the interval.** Babbel's review manager runs 1, 4, 7, 14,
  60 days and six months, and a mistake sends an item back to the next day. That
  is P1 and P2, arrived at independently by a shipping product rather than only
  by the book.
- **Scaffolding fades rather than switching off.** Speak shows the sentence,
  then progressively covers words, then cues from the learner's own language
  with nothing shown. We jump from a word shown with its meaning straight to
  being asked for it cold.
- **Speech feedback is per word, not per utterance.** Speak lights up the words
  it matched and leaves the rest neutral.
- **Speaking can be turned down or off, by the learner.** Rosetta Stone has a
  precision slider from easy to difficult and a checkbox that disables the
  speech requirement; Duolingo's skip pauses speaking for fifteen minutes.
- **Repeated failures get diagnosed, not just recorded.** After three failed
  attempts Rosetta Stone offers reasons, too noisy, cannot hear you, speak more
  softly, and an option to continue without speech.
- **The lenient-grader trap.** Reviewers report Speak passing mispronounced
  words and even reordered sentences. That is the failure our matcher exists to
  avoid, so a complaint about a rejection argues for the override, not a softer
  grader.
- **Rejected: streaks, experience points and leagues.** They measure attendance.
  The share of answers recalled measures learning, and the app already shows it.

### D11 — The sitting is a queue words come back into (2026-09-06)

The sitting was a list built when it started, so the short rungs of the interval
ladder could never fire: a word missed at the beginning could not return until
the next day, whatever the schedule said. Pimsleur fires four of its rungs
before a lesson ends, and Duolingo will not finish a lesson while an item is
still wrong.

Answering a card now puts it back into the queue, at a distance the grade
chooses: three cards for a word missed, six for one half known or just met, and
not at all for one recalled. A word appears at most three times in a sitting, so
one stubborn word cannot eat the session. Teaching uses the same mechanism, so a
word met is asked for a few cards later rather than after every other
introduction.

Progress is counted in words rather than cards, because the queue grows as words
are put back and a card count would climb under the learner. A word is finished
when it has no appearance left ahead of it. The verdict says when a word is
coming back, so its return is expected.

### D12 — The ladder follows a streak, and a miss resets it (2026-09-06)

P2, and the substance of P1. The interval came from a lifetime count of
reviews, so a word answered ten times and then forgotten went straight back to a
long interval the moment it was recalled once. It now comes from the current run
of recalls: a miss ends the run and sends the word to the bottom of its ladder,
a recall extends it, and a half recall holds position without earning a longer
wait. Babbel's scheduler does the same, sending a missed item back to the next
day whatever its history.

`WordProgress` also stores the run as it stood before the last answer. Without
it a correction cannot be applied properly: a miss has already destroyed the run
it replaced, so overturning that miss had no way back to where the word stood.

The three grades stay. Only their effect on the schedule changed.

### D13 — The recall window is enforced (2026-09-06)

P7. A review gets ten seconds. The countdown stays hidden until the last few,
so it does not rush a learner who is answering perfectly well, and running out
is not a failure: it offers the same two honest choices a mishearing offers,
because hesitating and forgetting are not the same thing. It does not run while
a word is being met, since that is not a test.

### D14 — The rest of the assessed items (2026-09-06)

**Per-word feedback.** A spoken answer is graded as a whole, but the verdict now
shows which of its words were heard, struck through where they were not. Speak
does this and it is far more use on a phrase than a single verdict. It appears
only after grading, where the answer is already on screen: showing it during the
question would give the answer away.

**A fading scaffold.** A word met earlier in the same sitting is asked with the
start of its answer available behind a hint, rather than cold. Meeting a word
and then being asked for it with nothing at all is a cliff, and Speak covers its
sentences progressively for the same reason.

**The learner decides how strictly it listens, and whether it listens.**
Forgiving, normal and strict map to grading thresholds; a switch says the
learner cannot speak right now and takes the microphone away for the session.
Rosetta Stone has both. Round length is a setting too, which is what finally
makes the daily goal reachable.

**Being unheard is diagnosed.** After three unheard attempts the card says so,
suggests what to check, and offers to continue without speaking, rather than
only recording a failure.

### D15 — The schedule reads what the log records (2026-09-06)

P6. The ladder was the same for every word: what was measured went into the log
and never came back out. Two signals now bend it, both named by the method. A
word that keeps being forgotten comes back sooner, each lapse cutting the wait
and never below a floor. A recall that arrives in under a couple of seconds
stretches it, because an answer that quick says the interval was too short. The
result is clamped to the ladder it belongs to: the signals nudge the schedule,
they do not replace it.

Only a recall can be effortless. Answering "I did not know it" quickly says
nothing about the interval and is read as nothing.

### D16 — Words that look alike are not met on the same day (2026-09-06)

Half of P5, the half that needs no new data. The method is blunt that learning
six and seven together, or green and yellow, makes them stick to each other
instead of to their meanings, and our words are grouped by topic, which is
exactly the arrangement that produces those pairs. The plan now skips a new word
that is too similar to one already chosen for the sitting, judged on both sides
since a pair can collide in what is shown or in what has to be produced. If
everything left clashes it introduces one anyway: a sitting with nothing new is
worse than a lookalike. Reviews are never held back, only introductions.

Frequency ordering, the other half of P5, still needs data we do not have.

### D17 — The server reports the wait, not just the moment (2026-09-06)

The verdict worked out "back in a day" by subtracting the browser's clock from
the server's timestamp. A device whose clock is off by hours would have shown
nonsense, and a test that controls the page clock did show it. The write route
now returns the delay it chose alongside the moment, and the session carries it.

### D18 — Speech synthesis is the audio, and images are dropped (2026-09-06)

**Images are not coming.** The method wants a picture instead of a translation
so the learner cannot lean on their own language. Ours is a Hebrew speaker
learning Hungarian, for whom the Hebrew word *is* the meaning, and the book is
equally clear that the value of an image comes from the learner choosing it, not
from a stock photo shipped with the deck. Buying the licensing and storage cost
without that benefit would be paying for the wrong half.

**The browser reads the words.** It costs nothing per word, covers the whole
deck, and can be slowed down, which is what a learner imitating a sound needs.

Two things that had to be handled for that to be honest:

- A browser asked for a language it has no voice for does not refuse. It reads
  the text with whatever voice it has, so Hungarian comes out in an English or
  Hebrew accent. For an app whose first principle is pronunciation that is worse
  than silence, so the app now says nothing unless a Hungarian voice exists, and
  says why on the setup screen.
- Speed is the learner's, slow, normal or natural, remembered with their other
  preferences.

**Recorded audio remains available if the ear trainer is ever built.** Every one
of a twenty-word sample from our own deck has a pronunciation recording on
Wikimedia Commons, around thirteen kilobytes each as Ogg Vorbis, mostly CC
BY-SA, which obliges naming the author and licence. The whole Hungarian category
is about four thousand files. Two caveats for whoever picks it up: Safari has
historically not decoded Ogg, so mobile needs a transcode, and Forvo is not an
option at any price, since its terms forbid caching and meter every playback.

### D19 — Listening is Chrome and Edge only, deliberately (2026-09-06)

The Web Speech API exists nowhere else, and the alternatives all cost more than
they are worth here: a server-side recogniser means audio upload, latency and a
bill per utterance, and a second implementation means two spoken paths to keep
working. So there is one, it is the browser's, and the rest of the world gets
the button session.

That session is a complete way to study rather than a stub: the same cards, the
same schedule, self-grading in place of a spoken answer. What was missing was
telling those learners what would work, so the notice now names Chrome and Edge
instead of only saying this browser cannot hear.

## Proposed, not yet decided

### P1 — Collapse the three grades into pass and fail

The reset landed with D12, so what is left of P1 is only the shape of the
grades. The method wants two, and ours are three. Worth deciding on evidence
now that the log records which grade was chosen: if the middle one is rarely
used, or used where a pass belongs, it should go.

### P3 — Cards carry more than two strings

Images are decided against (D18) and audio is handled by the browser, so what is
left of this item is a phonetic transcription, which the method says stops a
learner producing a spelling-contaminated sound. Hungarian spelling is shallow
enough that the book itself says recordings will do, so this is low priority.
Example sentences would be the more valuable addition, and are the method's own
next step after single words.

### P4 — A minimal-pairs ear trainer before vocabulary

The method's first stage, which we skip entirely. Synthesis is not a good enough
source here: the same engine producing both members of a pair gives them the
same idiosyncrasies, so the discrimination task is not the one the learner needs
to pass. This is the one place real recordings are worth harvesting, and D18
records where they are.

### P5 — Frequency ordering

Confusable words are now kept apart (D16). What remains is ordering by how often
a word is actually used, which needs frequency data for Hungarian that we do not
have.

