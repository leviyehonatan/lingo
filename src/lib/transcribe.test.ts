import { describe, expect, it } from 'vitest';
import { toHebrew, toIpa } from './transcribe';

describe('toIpa', () => {
  it('reads the digraphs as one sound each', () => {
    expect(toIpa('sz')).toBe('ˈs');
    expect(toIpa('s')).toBe('ˈʃ');
    expect(toIpa('zs')).toBe('ˈʒ');
    expect(toIpa('cs')).toBe('ˈtʃ');
    expect(toIpa('c')).toBe('ˈts');
    expect(toIpa('gy')).toBe('ˈɟ');
    expect(toIpa('ny')).toBe('ˈɲ');
    expect(toIpa('ty')).toBe('ˈc');
    expect(toIpa('ly')).toBe('ˈj');
    expect(toIpa('dzs')).toBe('ˈdʒ');
  });

  it('tells the short vowels from the long ones', () => {
    expect(toIpa('a')).toBe('ˈɒ');
    expect(toIpa('á')).toBe('ˈaː');
    expect(toIpa('e')).toBe('ˈɛ');
    expect(toIpa('é')).toBe('ˈeː');
    expect(toIpa('ö')).toBe('ˈø');
    expect(toIpa('ű')).toBe('ˈyː');
  });

  it('transcribes whole words', () => {
    expect(toIpa('igen')).toBe('ˈigɛn');
    expect(toIpa('köszönöm')).toBe('ˈkøsønøm');
    expect(toIpa('viszontlátásra')).toBe('ˈvisontlaːtaːʃrɒ');
    expect(toIpa('magyar')).toBe('ˈmɒɟɒr');
  });

  it('reads a doubled consonant as a long one, digraphs included', () => {
    expect(toIpa('itt')).toBe('ˈitː');
    expect(toIpa('asszony')).toBe('ˈɒsːoɲ');
    expect(toIpa('könnyű')).toBe('ˈkøɲːyː');
    expect(toIpa('meggy')).toBe('ˈmɛɟː');
  });

  it('stresses the first syllable of every word', () => {
    expect(toIpa('jó napot')).toBe('ˈjoː ˈnɒpot');
  });

  it('leaves punctuation where it is', () => {
    expect(toIpa('hogy vagy?')).toBe('ˈhoɟ ˈvɒɟ?');
    expect(toIpa('a nevem...')).toBe('ˈɒ ˈnɛvɛm...');
  });

  it('ignores case', () => {
    expect(toIpa('Igen')).toBe('ˈigɛn');
  });
});

describe('toHebrew', () => {
  it('writes the sibilants the Hungarian way round', () => {
    // `s` is what a Hebrew reader would call shin, `sz` is samekh.
    expect(toHebrew('sajt')).toBe('שָׁיְט');
    expect(toHebrew('szia')).toBe('סִיָה');
  });

  it('points the vowels and carries a leading one on alef', () => {
    expect(toHebrew('igen')).toBe('אִיגֶן');
    expect(toHebrew('nem')).toBe('נֶם');
  });

  it('shows long a with a mater, and o and u on vav', () => {
    expect(toHebrew('viszontlátásra')).toBe('וִיסוֹנְטְלָאטָאשְׁרָה');
    expect(toHebrew('jó')).toBe('יוֹ');
    expect(toHebrew('kutya')).toBe('קוּטְיָה');
  });

  it('marks the palatals with a yod and the affricates with a geresh', () => {
    expect(toHebrew('magyar')).toBe('מָדְיָר');
    expect(toHebrew('bocsánat')).toBe('בוֹצָ׳אנָט');
    expect(toHebrew('zsák')).toBe('זָ׳אק');
  });

  it('uses final letter forms', () => {
    expect(toHebrew('kérem')).toBe('קֵירֶם');
    expect(toHebrew('sajnálom')).toBe('שָׁיְנָאלוֹם');
  });

  it('approximates the vowels Hebrew does not have', () => {
    expect(toHebrew('köszönöm')).toBe('קֶסֶנֶם');
    expect(toHebrew('üt')).toBe('אִיט');
  });

  it('keeps spaces and punctuation', () => {
    expect(toHebrew('hogy vagy?')).toBe('הוֹדְי וָדְי?');
  });
});
