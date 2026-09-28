// Voices for the people of the game. The browser voice is the same for all people,
// so each kind of person gets another pitch and speed, and a male or female voice
// when the device has one. The profiles are in data/config/game.json ("voices").

// The voice profile name of a speaker.
// speaker: 'narrator', 'hero', an NPC id, a friend id, or null.
// data: { npcs, friends, voices }. profile: the profile of the player (for the hero and Gióng).
export function voiceOf(speaker, data, profile = null) {
  if (!speaker || speaker === 'narrator') return 'narrator';
  if (speaker === 'hero') return profile?.hero?.gender === 'girl' ? 'girl' : 'boy';
  if (speaker === 'giong') return profile?.flags?.['giong.grown'] ? 'man' : 'boy';
  const npc = data.npcs?.[speaker];
  if (npc?.voice) return npc.voice;
  const friend = data.friends?.[speaker];
  if (friend?.voice) return friend.voice;
  return data.voices?.speakers?.[speaker] ?? 'narrator';
}

// Words in the names of browser voices that tell a male or a female voice.
const MALE = ['male', 'nam minh', 'namminh', 'microsoft an', 'david', 'daniel', 'fred', 'alex', 'tom', 'aaron', 'arthur', 'guy', 'mark', 'george', 'ryan', 'eric', 'christopher', 'rishi', 'oliver'];
const FEMALE = ['female', 'linh', 'hoaimy', 'hoai my', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'zira', 'aria', 'jenny', 'susan', 'fiona', 'serena', 'kate', 'libby', 'sonia', 'google'];

export function voiceGender(name) {
  const n = String(name ?? '').toLowerCase();
  if (MALE.some((w) => n.includes(w)) && !n.includes('female')) return 'male';
  if (FEMALE.some((w) => n.includes(w))) return 'female';
  return null;
}

// Choose a browser voice for a language. gender: 'male', 'female', or null.
// voices: [{ name, lang, localService }]. A voice of the other gender is better than none.
export function chooseVoice(voices, code, gender = null) {
  const tag = code === 'vi' ? 'vi' : 'en';
  const own = voices.filter((v) => v.lang?.toLowerCase().startsWith(tag));
  if (own.length === 0) return null;
  const local = (list) => list.find((v) => v.localService) ?? list[0] ?? null;
  if (gender) {
    const match = own.filter((v) => voiceGender(v.name) === gender);
    if (match.length) return local(match);
  }
  return local(own);
}
