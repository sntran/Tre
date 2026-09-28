// The daily time limit. The parent sets the minutes for each day (0 = no limit).
// When the time is over, the hero goes home to rest at a calm point, never in a battle.
// time: { day: 'YYYY-MM-DD', usedMs, extraMs }

const MINUTE = 60 * 1000;

// The local date as text, for example "2026-09-28".
export function dayKey(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Add play time. A new day starts again from zero.
export function addPlayTime(time, now, deltaMs) {
  const today = dayKey(now);
  if (time.day !== today) {
    time.day = today;
    time.usedMs = 0;
    time.extraMs = 0;
  }
  time.usedMs += Math.max(0, Math.min(deltaMs, MINUTE));
  return time;
}

export function remainingMs(time, limitMin, now) {
  if (!limitMin) return Infinity;
  if (time.day !== dayKey(now)) return limitMin * MINUTE;
  return limitMin * MINUTE + (time.extraMs ?? 0) - time.usedMs;
}

// 'ok', 'warn' (a few minutes are left), or 'over'.
export function timeStatus(time, limitMin, warnMin, now) {
  const left = remainingMs(time, limitMin, now);
  if (left <= 0) return 'over';
  if (left <= warnMin * MINUTE) return 'warn';
  return 'ok';
}

// The parent gives more minutes for today.
export function extendTime(time, minutes, now) {
  addPlayTime(time, now, 0);
  time.extraMs = (time.extraMs ?? 0) + minutes * MINUTE;
  return time;
}
