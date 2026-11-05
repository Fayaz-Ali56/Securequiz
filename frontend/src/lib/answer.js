import { keccak256, toUtf8Bytes } from "ethers";

// The contract stores keccak256(answer) and compares it against keccak256 of
// whatever you submit - an exact, case-sensitive, whitespace-sensitive match.
// Typing "Only Owner" when the stored answer is "onlyowner" would cost you gas,
// a failed transaction and your streak.
//
// The stored hash is readable on-chain (the `questions` getter is public), so we
// can test candidate spellings locally, for free, before spending any gas. We
// generate sensible variants of what the player typed, hash each one, and submit
// only the variant that actually matches. If nothing matches, the player is told
// immediately and the chain is never touched.
//
// This is a real property of the design rather than a trick: low-entropy answer
// hashes are recoverable offline. See Rules -> "Known limitation".

const FILLER = /^(the|a|an|it is|its|it's|answer is|called|known as)\s+/i;

const MAX_SPLIT_LENGTH = 24; // cap the brute-forced split search

export function normalise(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[?.!,;:'"\u201c\u201d\u2018\u2019]/g, "")
    .replace(/\s+/g, " ");
}

/** English plural -> singular, and singular -> plural, for short answers. */
function numberForms(word) {
  const out = new Set([word]);
  if (word.endsWith("ies") && word.length > 4) out.add(word.slice(0, -3) + "y");
  if (word.endsWith("es") && word.length > 3) out.add(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 3) out.add(word.slice(0, -1));
  if (!word.endsWith("s")) {
    out.add(word + "s");
    if (word.endsWith("y")) out.add(word.slice(0, -1) + "ies");
    else out.add(word + "es");
  }
  return out;
}

/** Apply number forms to the last word of a phrase ("bug bounties" -> "bug bounty"). */
function phraseForms(phrase) {
  const parts = phrase.split(" ");
  const last = parts.pop();
  return [...numberForms(last)].map((w) => [...parts, w].join(" ").trim());
}

/**
 * Candidate spellings for what the player typed.
 * Order does not matter - we hash them all and keep whichever matches.
 */
export function variants(input) {
  const base = normalise(input);
  if (!base) return [];

  const seeds = new Set([base]);

  const stripped = base.replace(FILLER, "").trim();
  if (stripped) seeds.add(stripped);

  for (const s of [...seeds]) for (const f of phraseForms(s)) seeds.add(f);

  const out = new Set();

  for (const s of seeds) {
    if (!s) continue;
    out.add(s); // exactly as typed
    out.add(s.replace(/[\s-]/g, "")); // onlyowner, accesscontrol, thedao
    out.add(s.replace(/[\s-]+/g, " ")); // access control, flash loan
    out.add(s.replace(/\s+/g, "-")); // front-running
    out.add(s.replace(/-/g, " ")); // front running
    out.add("the" + s.replace(/[\s-]/g, "")); // "dao" -> "thedao"

    // If they typed it as one run-on word ("frontrunning"), we cannot know where
    // the break belongs - so try every break. Hashing is local and free, so a
    // few dozen extra guesses cost nothing and rescue a very common typo.
    const joined = s.replace(/[\s-]/g, "");
    if (joined.length <= MAX_SPLIT_LENGTH && joined === s) {
      for (let i = 2; i < joined.length - 1; i++) {
        const head = joined.slice(0, i);
        const tail = joined.slice(i);
        out.add(head + " " + tail);
        out.add(head + "-" + tail);
        for (const t of numberForms(tail)) {
          out.add(head + " " + t);
          out.add(head + "-" + t);
        }
      }
    }
  }

  return [...out].filter(Boolean);
}

/**
 * Find the spelling that matches the on-chain hash.
 * @returns the exact string to submit, or null if the answer is wrong.
 */
export function matchAnswer(input, answerHash) {
  if (!answerHash) return null;
  const target = String(answerHash).toLowerCase();
  for (const v of variants(input)) {
    if (keccak256(toUtf8Bytes(v)) === target) return v;
  }
  return null;
}
