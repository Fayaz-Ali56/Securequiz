import { readJSON, writeJSON } from "./feedback";

// Levels are a presentation layer over on-chain truth. The chain is the source
// of record for how many questions you have solved and how many PLAY you hold;
// XP and rank names are computed from that, plus local XP earned from ads.

const RANKS = [
  { level: 1, name: "Script Kiddie", xp: 0 },
  { level: 2, name: "Bug Hunter", xp: 150 },
  { level: 3, name: "Code Reviewer", xp: 400 },
  { level: 4, name: "Junior Auditor", xp: 800 },
  { level: 5, name: "Auditor", xp: 1400 },
  { level: 6, name: "Senior Auditor", xp: 2200 },
  { level: 7, name: "Lead Auditor", xp: 3200 },
  { level: 8, name: "Whitehat", xp: 4500 },
];

export const XP_PER_SOLVE = 120;

const KEY = "sq.progress";

function local() {
  return readJSON(KEY, { bonusXp: 0, days: [], lastDay: null });
}

export function addBonusXp(amount) {
  const s = local();
  writeJSON(KEY, { ...s, bonusXp: s.bonusXp + amount });
}

export function totalXp(solvedOnChain) {
  return Number(solvedOnChain || 0) * XP_PER_SOLVE + local().bonusXp;
}

export function rankFor(xp) {
  let current = RANKS[0];
  for (const r of RANKS) if (xp >= r.xp) current = r;
  const next = RANKS.find((r) => r.xp > xp) || null;

  const span = next ? next.xp - current.xp : 1;
  const into = next ? xp - current.xp : 1;

  return {
    level: current.level,
    name: current.name,
    nextName: next?.name ?? null,
    xpIntoLevel: into,
    xpForLevel: span,
    progress: next ? Math.min(1, into / span) : 1,
    xpToNext: next ? next.xp - xp : 0,
  };
}

// ---- daily play streak (calendar days opened, distinct from on-chain streak) ----

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function recordVisit() {
  const s = local();
  const d = today();
  if (s.lastDay === d) return s.days.length;
  const days = [...new Set([...s.days, d])].slice(-90);
  writeJSON(KEY, { ...s, days, lastDay: d });
  return days.length;
}

export function dayStreak() {
  const days = local().days;
  if (days.length === 0) return 0;
  const set = new Set(days);
  let streak = 0;
  const cursor = new Date();
  // Walk backwards from today while each day is present.
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!set.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ---- daily challenge ----

/**
 * Pick today's featured question deterministically, so every player on the same
 * day gets the same challenge and it changes at midnight without a backend.
 */
export function dailyPick(questions) {
  if (!questions || questions.length === 0) return null;
  const d = today();
  let h = 2166136261;
  for (let i = 0; i < d.length; i++) {
    h ^= d.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % questions.length;
  return questions[idx];
}

export function nextResetLabel() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((midnight - now) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
