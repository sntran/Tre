// The words of a fraction (#181: the voice said "Frac.11.12 cây tre."). The halves and the quarters
// have their own words ("một nửa", "một phần tư", "ba phần tư"); any other fraction is said from its
// parts with frac.say ("{n} phần {d}"), so that every fraction that a plan can make has words.
// Return a parameter of a line: { key, params }.
export function fracWord(a, b) {
  if ((a === 1 && b === 2) || (b === 4 && (a === 1 || a === 3))) return { key: `frac.${a}.${b}` };
  return { key: 'frac.say', params: { n: { key: `num.${a}` }, d: { key: b === 4 ? 'num.4.part' : `num.${b}` } } };
}
