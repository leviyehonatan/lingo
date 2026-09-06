# Voice mode

The hands-free study loop: the app shows a card, listens while the learner says
the prompt aloud, reveals the meaning, then listens for the learner to say it.
This capsule is the design, the constraints, and the parts the method in
[`method.md`](method.md) settles for us.

## The language problem solves itself

Speech recognition needs to be told which language it is listening for, and
accuracy collapses if it is told wrong. That looks like it forces the learner to
choose. It does not, because the session is a strict sequence of turns and the
app always knows which language it is expecting next. **Turn structure is the
disambiguator.** No language identification is needed.

Per card, in order:

| Stage | Shown | Listening for | Recognition language |
| --- | --- | --- | --- |
| Prompt | prompt side | the learner reading it aloud | prompt side |
| Reveal | both sides | nothing | none |
| Recall | prompt side, answer hidden again | the answer | answer side |
| Grade | verdict | nothing | none |

The existing reverse toggle swaps which language sits on which side. It is one
machine with the languages parameterized, never two machines.

## What the method fixes for us

- **Saying it aloud is part of every answer**, not a separate mode. Voice is the
  default way to review, not a feature bolted onto flashcards.
- **The recall window is five to ten seconds.** That is the silence timeout, and
  it is a deliberate ceiling, not a convenience. Silence past the window is a
  miss, and a miss must immediately reveal the answer.
- **Grade pass or fail, and reset the interval on a fail.** No partial credit. A
  hesitant answer that lands is a pass.
- **An instant, effortless answer is a signal the interval was too short**, which
  is the only thing a third grade should ever mean.
- **Grade the concept, not the string.** Any valid answer passes. Extra senses of
  a word get their own cards.
- **Grade the phoneme category, not the fine detail.** Errors that cross a real
  distinction in the target language count. Accent variation that the language
  does not use contrastively does not.
- **Feedback is immediate and binary.** That per-trial verdict is the mechanism
  the whole approach rests on.

## What the learner can do, and what it costs

Speaking now drives the session rather than sitting beside it. Every action on a
card says its consequence before it is taken.

| Action | Listens in | Effect |
| --- | --- | --- |
| Say the answer | the answer's language | The graded recall. What the grader hears becomes the grade. |
| Practise the sound | Hungarian | Nothing. Recorded as an attempt, never touches the schedule. Offered only when the Hungarian is the side on screen, since saying a word already shown is mouth practice, not recall. |
| Show the answer | — | An admission. Records the card as not known, overturnable in the next click. |
| Next | — | Only exists once a verdict does. |

That third row is what makes the demonstration active. While revealing was free
and ungraded, nothing obliged the learner to try.

The three grade buttons did not disappear. They are the manual path for a
browser that cannot hear, and the correction row on every verdict.

Silence is an answer: when the recognizer closes with nothing heard, the card is
graded as not known and the verdict says so, rather than the session stalling.

## Two skills, graded differently

Reading aloud a word that is on screen tests pronunciation. Recalling its
meaning tests memory. They are not the same event and must not feed the same
counter.

- The prompt stage gates the reveal and records pronunciation attempts. It must
  never advance the spaced-repetition ladder.
- Only the recall stage grades the card.
- A word the learner has never seen should be taught, not tested. Show both
  sides, ask for a repetition, grade nothing. Demand recall only once the word
  has a status that says it should be known.

## Matching a spoken answer

Grading lives in `src/lib/answer-match.ts`, pure and unit tested, shared by
anything that has to decide whether an answer counts.

What it does:

- normalizes case, punctuation, Hebrew vowel points and whitespace before any
  comparison;
- accepts either side of a slashed entry, and a word with or without the sense
  qualifier our data keeps in parentheses, because any correct answer passes;
- accepts the answer spoken with filler around it, by looking for the whole
  expected phrase at word granularity rather than as a character substring;
- forgives a single dropped diacritic in a longer word through an edit-distance
  threshold, while demanding an exact match on short words, where one edit is
  usually a different word;
- considers every candidate transcript the recognizer returns, not just the one
  it ranks first.

It replaced a check that accepted a match when either string contained the
other, which let a single spoken syllable score a word correct, and which ran on
interim results so it could fire before the learner finished speaking.

The override exists: the verdict panel offers the other two grades, and taking
one rewrites the review rather than adding a second, so a correction never
advances the interval ladder. The recognizer is not the last word on a failure.

## Platform reality

- The Web Speech API is Chrome and Edge only, and in Chrome the audio is sent to
  Google's servers. Safari and Firefox need the tap-and-type fallback.
- Hebrew recognition is weaker than Hungarian, and unvocalized script makes
  transcripts vary. Expect false negatives, which is the second reason the
  manual override is not optional.
- The recognition language cannot be changed mid-run. Use one recognizer
  instance restarted per turn.
- Never listen while the app is speaking, or it transcribes itself.
- Microphone permission must be requested once and held. A loop that re-prompts
  is unusable.

## Shape of the implementation

Put the loop in `src/lib` as a pure state machine over events such as heard,
timed out and skipped, returning the next state and any grade. The React hook
only wires the browser API to it. That matches how the study filters are already
factored, it makes the loop unit testable without a microphone, and it lets an
end-to-end test drive a fake recognizer.

## Ear training comes first

The method puts a minimal-pairs trainer before vocabulary: play a recording, ask
which of two words it was, score instantly. We have no such feature and no audio
assets, so this is a real prerequisite we are currently skipping. Voice mode can
ship without it, but the learner will be producing sounds they cannot reliably
hear, which is the failure the method is built to prevent. Worth scheduling
rather than forgetting.
