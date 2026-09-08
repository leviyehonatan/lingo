/**
 * One example sentence per word, for the moment a word is introduced.
 *
 * The method's step after a single word is the word *in use*: a bare pair of
 * translations gives a learner nothing to hang the word on, and for a
 * homograph it gives them the wrong thing entirely — `hát` is ranked as the
 * discourse particle and `fog` as the future auxiliary, while our entries mean
 * "back" and "tooth". A sentence settles which word is meant.
 *
 * Written for this app, not taken from a corpus, and **not yet reviewed by a
 * native speaker** — see P3 in `docs/learning/decisions.md`. Sentences are
 * short on purpose: one new grammatical idea at most, so the sentence teaches
 * the word rather than the other way round.
 *
 * Coverage is deliberately partial: these are the words a learner actually
 * meets first, by frequency (D22, D23). A word with no sentence simply shows
 * none.
 */

export interface Example {
  hu: string;
  he: string;
}

export const examples: Readonly<Record<string, Example>> = {
  'a1-g-2': { hu: 'Nem tudom.', he: 'אני לא יודע.' },
  'a1-n-2': { hu: 'Kérek egy kávét.', he: 'אני מבקש קפה אחד.' },
  'a1-g-1': { hu: 'Igen, kérek.', he: 'כן, בבקשה.' },
  'a1-g-13': { hu: 'Szia, hogy vagy?', he: 'היי, מה שלומך?' },
  'a1-t-18': { hu: 'Most nem érek rá.', he: 'עכשיו אני לא פנוי.' },
  'a1-adj-3': { hu: 'Ez egy jó könyv.', he: 'זה ספר טוב.' },
  'a1-g-14': { hu: 'Köszönöm, jól vagyok.', he: 'תודה, אני בסדר.' },
  'a1-g-21': { hu: 'Rendben, holnap találkozunk.', he: 'בסדר, נתראה מחר.' },
  'a1-t-21': { hu: 'Mindig reggel kávézom.', he: 'אני תמיד שותה קפה בבוקר.' },
  'a1-g-22': { hu: 'Talán holnap ráérek.', he: 'אולי מחר אהיה פנוי.' },
  'a1-g-3': { hu: 'Köszönöm a segítséget.', he: 'תודה על העזרה.' },
  // The body part, not the "well..." that the frequency list is counting.
  'a1-b-12': { hu: 'Fáj a hátam.', he: 'הגב שלי כואב.' },
  'a1-n-35': { hu: 'Ez elég lesz.', he: 'זה יספיק.' },
  // The tooth, not the future auxiliary.
  'a1-b-16': { hu: 'Fáj a fogam.', he: 'השן שלי כואבת.' },
  'a1-adj-30': { hu: 'Ez igaz.', he: 'זה נכון.' },
  'a2-fe-18': { hu: 'Biztos vagyok benne.', he: 'אני בטוח בזה.' },
  'a1-adj-1': { hu: 'Ez egy nagy ház.', he: 'זה בית גדול.' },
  'a1-t-8': { hu: 'Ma szép idő van.', he: 'היום מזג האוויר יפה.' },
  'a1-g-24': { hu: 'Sajnálom, késtem.', he: 'אני מצטער, איחרתי.' },
  'a1-g-23': { hu: 'Persze, segítek.', he: 'כמובן, אני אעזור.' },
  'a1-n-30': { hu: 'Sok dolgom van.', he: 'יש לי הרבה עבודה.' },
  'a1-g-16': { hu: 'Bocsánat, nem értem.', he: 'סליחה, אני לא מבין.' },
  'a1-g-4': { hu: 'Szia, jó látni téged!', he: 'היי, טוב לראות אותך!' },
  'a1-adj-7': { hu: 'Ez egy új telefon.', he: 'זה טלפון חדש.' },
  'a1-g-8': { hu: 'Kérem, várjon egy percet.', he: 'בבקשה, חכה רגע.' },
  'a1-n-32': { hu: 'Több időre van szükségem.', he: 'אני צריך יותר זמן.' },
  'a1-t-24': { hu: 'Soha nem késik.', he: 'הוא אף פעם לא מאחר.' },
  // Two entries, two senses: the day here, the sun below.
  'a1-t-25': { hu: 'Szép nap volt.', he: 'זה היה יום יפה.' },
  'a1-w-2': { hu: 'Süt a nap.', he: 'השמש זורחת.' },
  'a1-adj-5': { hu: 'Nagyon szép ez a kép.', he: 'התמונה הזאת יפה מאוד.' },
  'a1-n-27': { hu: 'Ez az első nap.', he: 'זה היום הראשון.' },
  'a1-adj-4': { hu: 'Rossz idő van.', he: 'מזג האוויר רע.' },
  'a1-t-13': { hu: 'Este otthon vagyok.', he: 'בערב אני בבית.' },
  'a1-f-2': { hu: 'Az apám orvos.', he: 'אבא שלי רופא.' },
  'a1-v-1': { hu: 'Itt van a kulcs.', he: 'הנה המפתח.' },
  'a1-f-1': { hu: 'Az anyám tanár.', he: 'אמא שלי מורה.' },
  'a1-n-4': { hu: 'Három gyerekem van.', he: 'יש לי שלושה ילדים.' },
  'a1-v-5': { hu: 'Mit akarsz mondani?', he: 'מה אתה רוצה לומר?' },
  'a1-t-9': { hu: 'Holnap dolgozom.', he: 'מחר אני עובד.' },
  'a1-v-16': { hu: 'Szeretnék magyarul beszélni.', he: 'הייתי רוצה לדבר הונגרית.' },
  'a1-w-1': { hu: 'Nincs időm.', he: 'אין לי זמן.' },
  'a1-v-6': { hu: 'Nem látok semmit.', he: 'אני לא רואה כלום.' },
  'a1-adj-21': { hu: 'Ez a táska nehéz.', he: 'התיק הזה כבד.' },
  'a1-f-18': { hu: 'A lányom öt éves.', he: 'הבת שלי בת חמש.' },
  'a1-v-21': { hu: 'Nem tudok magyarul.', he: 'אני לא יודע הונגרית.' },
};
