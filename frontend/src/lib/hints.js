// Hints are written by hand and bundled with the app. They deliberately do NOT
// contain the answers - the answers live only as keccak hashes on-chain. Each
// hint gives a nudge plus the shape of the answer (word and letter counts),
// which is enough to unstick someone without handing it over.
//
// Matching is done on a distinctive fragment of the question text rather than
// the question id, so hints survive questions being added or deactivated.

const HINTS = [
  {
    key: "call back into a function before its state",
    clue: "The name describes the act of entering the same function again while the first call is still open.",
    shape: "1 word, 10 letters",
  },
  {
    key: "updates state BEFORE making external calls",
    clue: "It is named after the three steps in the order you must do them. Validate first, write second, call out last.",
    shape: "3 hyphenated words",
  },
  {
    key: "only the contract owner",
    clue: "It is the modifier OpenZeppelin's Ownable gives you, written in camelCase in the docs.",
    shape: "1 word, 9 letters",
  },
  {
    key: "hides its value from anyone reading raw blockchain",
    clue: "Storage on a public chain is readable by anyone who queries the slot directly. `private` only restricts other contracts.",
    shape: "true or false",
  },
  {
    key: "halt all state-changing functions in an emergency",
    clue: "The OpenZeppelin contract shares its name with the emergency stop it provides.",
    shape: "1 word, 8 letters",
  },
  {
    key: "fork into ETH and ETC",
    clue: "It was a 2016 investment fund built as a smart contract. Its name is an acronym, and you say it with the definite article.",
    shape: "1 word, 6 letters",
  },
  {
    key: "lock that prevents a function from being re-entered",
    clue: "Standard concurrency term, short for mutual exclusion.",
    shape: "1 word, 5 letters",
  },
  {
    key: "wrap from 0 to its max value on subtraction",
    clue: "Going below the minimum, rather than above the maximum.",
    shape: "1 word, 9 letters",
  },
  {
    key: "exceeds its maximum storage size and wraps back",
    clue: "The opposite of the previous one. Going above the ceiling.",
    shape: "1 word, 8 letters",
  },
  {
    key: "custom named permissions instead of a single owner",
    clue: "OpenZeppelin's role-based alternative to Ownable. Two words in the docs, run together in the contract name.",
    shape: "1 word, 13 letters",
  },
  {
    key: "missing permission checks on a sensitive function",
    clue: "The broad audit category, written as two ordinary words with a space.",
    shape: "2 words, 13 letters",
  },
  {
    key: "initializer before the legitimate deployer",
    clue: "The proxy was deployed but never set up. Describe that state, then the thing it applies to.",
    shape: "2 words, 20 letters",
  },
  {
    key: "risky default for functions in versions before Solidity 0.5",
    clue: "The most permissive visibility keyword - anyone can call it.",
    shape: "1 word, 6 letters",
  },
  {
    key: "12 or 24 word backup",
    clue: "The human-readable backup you write on paper when a wallet is created.",
    shape: "2 words, 10 letters",
  },
  {
    key: "never connected to the internet",
    clue: "The opposite of a hot one. Named for its temperature.",
    shape: "2 words, 10 letters",
  },
  {
    key: "fake but convincing website",
    clue: "The classic email and fake-site attack, spelled with a 'ph'.",
    shape: "1 word, 8 letters",
  },
  {
    key: "without ever exposing the private key to the connected computer",
    clue: "A dedicated physical device that signs internally. Think Ledger or Trezor.",
    shape: "2 words, 14 letters",
  },
  {
    key: "between someone else's transaction and its confirmation",
    clue: "You saw their transaction in the mempool and got in ahead of it.",
    shape: "hyphenated, 12 letters",
  },
  {
    key: "borrowing a huge sum with no collateral",
    clue: "Borrow and repay inside one transaction, or the whole thing reverts. Named for how fast it happens.",
    shape: "2 words, 9 letters",
  },
  {
    key: "temporarily distort an asset's price",
    clue: "Name the data source being abused, then what the attacker does to it.",
    shape: "2 words, 19 letters",
  },
  {
    key: "reliable external data like price feeds",
    clue: "The bridge between off-chain data and on-chain contracts. Chainlink is the best known.",
    shape: "1 word, 6 letters",
  },
  {
    key: "systematic review of smart contract code",
    clue: "The same word a company's finances go through once a year.",
    shape: "1 word, 5 letters",
  },
  {
    key: "pays independent researchers for responsibly disclosing",
    clue: "Two words: the thing you find, and the reward posted for it.",
    shape: "2 words, 9 letters",
  },
  {
    key: "static-analysis tool (from Trail of Bits)",
    clue: "Named after a legless reptile, in keeping with Solidity's snake theme.",
    shape: "1 word, 7 letters",
  },
  {
    key: "cannot be changed or upgraded after deployment",
    clue: "The Solidity keyword for a value fixed at construction, used here as an adjective for the whole contract.",
    shape: "1 word, 9 letters",
  },
];

/** Strip the "[Category] " prefix so hints match regardless of tagging. */
function bare(text) {
  return String(text || "").replace(/^\[[^\]]+\]\s*/, "");
}

export function hintFor(questionText) {
  const t = bare(questionText).toLowerCase();
  const found = HINTS.find((h) => t.includes(h.key.toLowerCase()));
  return found ? { clue: found.clue, shape: found.shape } : null;
}

export function hasHint(questionText) {
  return hintFor(questionText) !== null;
}
