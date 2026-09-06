import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPEECH_RATE,
  clampRate,
  hasHungarianVoice,
  pickHungarianVoice,
} from './speech-voice';

const voices = [
  { name: 'Carmit', lang: 'he-IL', localService: true },
  { name: 'Tünde', lang: 'hu-HU', localService: true },
  { name: 'Hungarian Online', lang: 'hu-HU', localService: false },
  { name: 'Daniel', lang: 'en-GB', localService: true },
];

describe('pickHungarianVoice', () => {
  it('picks a Hungarian voice over the rest', () => {
    expect(pickHungarianVoice(voices)?.name).toBe('Tünde');
  });

  it('prefers one installed on the device, which works offline', () => {
    expect(pickHungarianVoice([voices[2], voices[1]])?.name).toBe('Tünde');
  });

  it('takes a remote Hungarian voice rather than none', () => {
    expect(pickHungarianVoice([voices[0], voices[2]])?.name).toBe('Hungarian Online');
  });

  it('accepts the language written either way round', () => {
    expect(pickHungarianVoice([{ name: 'x', lang: 'hu_HU' }])?.name).toBe('x');
    expect(pickHungarianVoice([{ name: 'x', lang: 'HU' }])?.name).toBe('x');
  });

  it('says there is none rather than offering the wrong language', () => {
    expect(pickHungarianVoice([voices[0], voices[3]])).toBeNull();
    expect(hasHungarianVoice([voices[0], voices[3]])).toBe(false);
    expect(pickHungarianVoice([])).toBeNull();
  });
});

describe('clampRate', () => {
  it('keeps a sensible rate as it is', () => {
    expect(clampRate(0.6)).toBe(0.6);
  });

  it('refuses a rate too slow to follow or too fast to hear', () => {
    expect(clampRate(0.1)).toBe(0.5);
    expect(clampRate(9)).toBe(1.5);
  });

  it('falls back when handed nonsense', () => {
    expect(clampRate(NaN)).toBe(DEFAULT_SPEECH_RATE);
  });
});
