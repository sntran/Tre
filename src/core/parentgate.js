// The parent gate: hold a button for some seconds, then answer a question
// for adults (the product of two numbers from 12 to 19).

export function makeGateQuestion(rng, { min = 12, max = 19 } = {}) {
  const a = rng.int(min, max);
  const b = rng.int(min, max);
  return { a, b, answer: a * b };
}

export function checkGateAnswer(question, text) {
  const n = Number(String(text).trim());
  return Number.isInteger(n) && n === question.answer;
}

// A hold is complete when the pointer stays down for holdMs.
export function holdProgress(startMs, nowMs, holdMs) {
  if (startMs === null) return 0;
  return Math.max(0, Math.min(1, (nowMs - startMs) / holdMs));
}
