# The method we are building toward

Distilled from *Fluent Forever* (Gabriel Wyner, 2014). Our words, our
conclusions. Numbers attributed to the book are the author's own figures, kept
because they are what makes the prescriptions implementable.

## The three keys

1. **Pronunciation before vocabulary.** Learn the sound system first, so every
   later word attaches to sounds you can already hear and produce.
2. **Do not translate.** A card should link the target word to a meaning, not to
   a word in the learner's own language.
3. **Spaced repetition.** Test just before forgetting, and let the schedule, not
   the learner, decide when.

## Why memory works, and what each principle buys

The book ranks encodings by how durable they are: letter shapes, then sound,
then meaning, then personal connection. Each step up roughly doubles retention,
and a personal hook adds about half again on top of meaning, so a personally
connected memory is several times stickier than a shape-level one. A card that
pairs two letter strings sits at the bottom of that ladder.

Four consequences we care about:

- **Recall beats review.** Being tested is what builds the memory. The book puts
  the exchange rate near five to one, so a few minutes of self-testing is worth
  far more than the same time spent re-reading.
- **Overlearning is waste.** Once the learner produces the answer unaided, stop.
  Extra drilling that day buys nothing durable.
- **Difficulty is the point.** An answer that arrives instantly is the one most
  likely to be gone in a week. Mild effort adds retention, near-forgetting adds
  much more. Hesitation is the target state, not a problem to design away.
- **Feedback on failure is mandatory.** A failed recall with no answer shown
  teaches nothing. The answer has to appear while the attempt is still warm.

## Scheduling

- Intervals start at a few days and grow multiplicatively, roughly two to three
  times per success, out to months and then years.
- **A miss resets to the shortest interval.** Not a demotion by one step. All the
  way back.
- Target accuracy is **90 to 95 percent**. Below that the intervals are too long
  or the cards are bad. Well above it, the intervals are too short and time is
  being wasted.
- Sustainable load is **fifteen to thirty new cards a day** alongside the reviews
  they generate, which the book puts at about half an hour of study. Triple that
  rate and you buy months of backlog.
- After missed days, clear the backlog before adding anything new, longest
  intervals first, and throttle new cards until the queue is normal.
- Daily load stabilizes on its own, because mature cards disappear into
  far-future intervals. Growth in the deck does not mean linear growth in work.

## What one review looks like

1. Show the front. Allow **five to ten seconds**, no more.
2. The learner recalls the *essential* facts for that card. For a vocabulary
   card that means the meaning and the pronunciation, **said out loud**. Saying
   it aloud is part of the answer, not an extra mode.
3. Optional bonus recall, such as a personal connection or a related word, is
   never graded.
4. Reveal, then grade **pass or fail**. Any essential fact missed is a fail.
   Effort, hesitation and a near-miss that lands are all passes.
5. Where a card has several valid answers, any one of them passes. Extra
   coverage comes from more cards, never from demanding a multi-part answer.

If a third grade exists it should mean *too easy, stretch the interval*, not
*partially right*.

## Cards

- **Small and atomic.** Many narrow cards beat one dense card. One question, one
  answer.
- **Meaning, not translation.** The book's card is target word plus image plus
  audio, with no word of the learner's own language on it.
- **Two directions are two different cards.** Recognizing a word and producing it
  are separate skills that schedule separately.
- **A personal hook at authoring time** is where the durability comes from. The
  hook is a short private cue, not an explanation.
- **Ambiguity is the failure mode.** A card that is clear to its author and vague
  to anyone else is why the book insists learners author their own cards, and
  why shared decks underperform.
- **A card that keeps failing is not rewritten, it is surrounded.** Add cards
  approaching the same item from other angles rather than polishing the one that
  fails.

## Sound first

- The failure the book is guarding against is the broken word: a word stored
  with a sound that does not match what natives say, so reading and listening
  never connect.
- **Minimal pairs** are the drill. Play one recording, ask which of two words it
  was, score instantly. The format is plain and the immediate per-trial verdict
  is the entire mechanism. Without that verdict, the same practice teaches
  nothing.
- Dosage the author reports for Hungarian specifically: **twenty minutes a day
  for ten days**.
- **Ears before mouth.** If the learner cannot hear a contrast, drill hearing. If
  they hear it but cannot produce it, work the articulation.
- Ground truth for production is **a native recording**, not a human judge. Say
  the word, play the recording, repeat until they match.
- Grade the phoneme category, not the fine detail. An error that crosses a real
  distinction in the target language matters. Variation that the language does
  not use to tell words apart does not.

## Which words, in which order

- **Frequency beats themes.** The book's figures: the top hundred words cover
  about half of what you read, a thousand about three quarters, two thousand
  about eighty percent, with returns thinning after that.
- **Thematic grouping actively hurts.** Learning six and seven, or green and
  yellow, in the same sitting makes them interfere. The book deliberately
  randomizes order to keep related items apart.
- Start from roughly **625 concrete, picturable, high-frequency words**, which
  the book expects to take one to two months.
- Function words are deferred until there are nouns and verbs to attach them to.

## Where lingo does not comply today

Honest gap list, so nobody assumes the app already implements the above.

- **Our cards are translation pairs.** A Hungarian string on one side, a Hebrew
  string on the other, which is the model the book argues against. The app reads
  the Hungarian aloud and writes how it sounds (D21), so the sound is there,
  but there is no image and no personal hook. Images are deliberately not
  coming; see D18 in `decisions.md`.
- **We have no sound-first stage at all.** No minimal-pair trainer, no recordings,
  no articulation help. The app currently starts where the book says to start
  second.
- **Word order now follows the book**, which it did not before: the offered
  path is the whole vocabulary, commonest first (D22, D23), with lookalikes
  kept out of the same sitting (D16). Themed topics remain as a deliberate
  drill rather than the only way in. What is still missing is a *reason* the
  set is 925 words: they are our own list, not the book's 625 picturable ones.
  The ranks are also blind to sense, so a homograph can be introduced far
  earlier than its meaning deserves (P9).
- **Words are met in a sentence only for the first forty.** D24 shows the word
  in use while teaching it, which is the method's step after single words; the
  other 885 still arrive as a bare pair of translations (P3).
- **The rungs are the same for everyone.** A word's interval now follows its
  own run of recalls and is bent by its own lapses and answer times (D15), but
  the ladder itself is fixed and nothing reads how a learner is doing overall,
  so a learner who finds everything easy climbs no faster than one who does not.

Closed since this was written. A word the learner has never met is taught
rather than tested, and the session decides its own contents instead of asking
the learner to assemble one. Spoken and typed answers are graded by
`src/lib/answer-match.ts`, which accepts any valid alternative and no longer
accepts a fragment. The study screen is a guided session that states its task at
every step, asks the learner to answer aloud, shows what each answer cost and
when the word returns, and lets a wrong verdict be overturned without charging
the word a second review. A word that is missed comes back inside the same
sitting, what the log records about a word now feeds its next interval, and
grading is pass or fail.

None of these are bugs against the current spec. They are the distance between
what lingo is and what the method asks for, and they are the menu that
`decisions.md` draws from.
