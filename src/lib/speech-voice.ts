/**
 * Choosing a voice to say Hungarian with, and knowing when there is not one.
 *
 * Synthesis is good enough to imitate, and it costs nothing per word, which is
 * why it is what the app speaks with. The catch is that a browser asked for a
 * language it has no voice for does not refuse: it reads the text with whatever
 * voice it has, so Hungarian comes out in an English or Hebrew accent. For an
 * app whose first principle is pronunciation, that is worse than silence, so
 * the absence has to be detected and said rather than papered over.
 */

export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
}

/** How fast the app speaks. Slower than natural, so sounds can be picked out. */
export const SPEECH_RATES = [0.6, 0.85, 1] as const;
export type SpeechRate = (typeof SPEECH_RATES)[number];
export const DEFAULT_SPEECH_RATE: SpeechRate = 0.85;

function isHungarian(voice: VoiceLike): boolean {
  return voice.lang.toLowerCase().replace('_', '-').startsWith('hu');
}

/**
 * The best Hungarian voice on offer, or null when the device has none.
 *
 * A voice installed on the device is preferred over one the browser fetches:
 * it works offline and starts without a network round trip.
 */
export function pickHungarianVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  const hungarian = voices.filter(isHungarian);
  if (hungarian.length === 0) return null;
  return hungarian.find((voice) => voice.localService) ?? hungarian[0];
}

export function hasHungarianVoice(voices: readonly VoiceLike[]): boolean {
  return pickHungarianVoice(voices) !== null;
}

/** Keep a rate the browser will accept, and that a learner can follow. */
export function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return DEFAULT_SPEECH_RATE;
  return Math.min(1.5, Math.max(0.5, rate));
}
