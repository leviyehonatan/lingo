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

The current matcher in the study page accepts a match when either string
contains the other, and it runs on interim results. Saying a single syllable that
happens to appear inside the target scores it correct before the learner has
finished speaking. It also reads only the top transcript although the recognizer
is asked for several. Before voice mode can be trusted it needs:

- normalization of case, punctuation and whitespace;
- a similarity threshold rather than substring containment, with a minimum
  length guard;
- every returned alternative considered, not just the first;
- final results preferred over interim ones for a fail verdict;
- a manual override, because the recognizer must never be the last word on a
  wrong answer.

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
