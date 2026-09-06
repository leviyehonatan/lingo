import type { Page } from '@playwright/test';

/**
 * Speech control for the specs.
 *
 * Chromium ships a real recognizer, so a page left alone takes the spoken path
 * and there is no microphone in CI to answer it. Every spec therefore says
 * which path it is testing: `fakeSpeech` drives the spoken one, `disableSpeech`
 * takes the self-grading fallback a browser without recognition would get.
 */

/** Make the page look like Safari or Firefox: nothing to listen with. */
export async function disableSpeech(page: Page) {
  await page.addInitScript(() => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition;
  });
}

/**
 * Install a recognizer the test drives itself. Afterwards the page exposes
 * `__say(transcript)` to speak and `__silence()` to hear nothing.
 */
export async function fakeSpeech(page: Page) {
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = '';
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        (window as unknown as { __live: FakeRecognition | null }).__live = this;
      }
      stop() {
        (window as unknown as { __live: FakeRecognition | null }).__live = null;
      }
      abort() {
        this.stop();
      }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
      FakeRecognition;
    (window as unknown as { __say: (text: string) => void }).__say = (text) => {
      const live = (window as unknown as { __live: FakeRecognition | null }).__live;
      live?.onresult?.({
        resultIndex: 0,
        results: [Object.assign([{ transcript: text }], { isFinal: true, length: 1 })],
      });
    };
    (window as unknown as { __silence: () => void }).__silence = () => {
      const live = (window as unknown as { __live: FakeRecognition | null }).__live;
      live?.onend?.();
    };
  });
}

/** Say something into the page's fake recognizer. */
export async function say(page: Page, text: string) {
  await page.evaluate(
    (spoken) => (window as never as { __say: (t: string) => void }).__say(spoken),
    text
  );
}

/** Let the listening window close with nothing heard. */
export async function saySilence(page: Page) {
  await page.evaluate(() => (window as never as { __silence: () => void }).__silence());
}
