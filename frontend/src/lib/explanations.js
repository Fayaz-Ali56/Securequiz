// After a question is solved the app explains *why* the answer is right. Testing
// recall is cheap; teaching the underlying idea is the part the player actually
// keeps. Matched on a fragment of the question text, like hints.js, so this
// survives questions being added, reordered or deactivated on-chain.

const EXPLANATIONS = [
  {
    key: "call back into a function before its state",
    title: "Reentrancy",
    body: "When a contract sends ETH or calls another contract, the receiving code runs immediately and can call straight back into the original function. If your balance is still recorded as unspent at that moment, the attacker withdraws again, and again, before the first call ever finishes. The bug is not the external call itself, it is making that call while your internal accounting is still stale.",
  },
  {
    key: "updates state BEFORE making external calls",
    title: "Checks-Effects-Interactions",
    body: "Validate inputs first, then write every state change, and only then talk to the outside world. Order matters because the external call is the only step that hands control to code you do not own. If your state is already correct before that happens, re-entering the function finds nothing left to steal.",
  },
  {
    key: "only the contract owner",
    title: "onlyOwner",
    body: "A modifier that runs before the function body and reverts unless msg.sender matches the stored owner. It is the simplest access control there is, and its weakness is that it is all or nothing: one key controls everything, so losing that key or having it stolen compromises the entire contract.",
  },
  {
    key: "hides its value from anyone reading raw blockchain",
    title: "private is not secret",
    body: "False. In Solidity, private controls which contracts may read a variable through the compiler, nothing more. Every storage slot is written to a public chain, and anyone can read it directly with eth_getStorageAt without asking your contract at all. Never store a password, a key or an unrevealed answer in contract storage and assume nobody can see it.",
  },
  {
    key: "halt all state-changing functions in an emergency",
    title: "Pausable",
    body: "An inherited OpenZeppelin contract that adds whenNotPaused to your functions and lets the owner freeze them during an incident. It buys time to respond to an active exploit, but it is also centralised power, so a real protocol has to justify who holds that switch and how it is governed.",
  },
  {
    key: "fork into ETH and ETC",
    title: "The DAO",
    body: "A 2016 investment fund on Ethereum, drained of around 3.6 million ETH through a reentrancy bug. The response split the community: the chain was forked to reverse the theft, and those who refused the rollback kept the original chain as Ethereum Classic. It is the reason reentrancy is the first vulnerability every Solidity developer learns.",
  },
  {
    key: "lock that prevents a function from being re-entered",
    title: "Mutex",
    body: "Short for mutual exclusion. A flag is set on entry and cleared on exit, and any call arriving while the flag is set reverts. OpenZeppelin's ReentrancyGuard and its nonReentrant modifier are exactly this pattern, and your own SecurityQuizGame uses it on submitAnswer.",
  },
  {
    key: "wrap from 0 to its max value on subtraction",
    title: "Underflow",
    body: "Before Solidity 0.8, subtracting 1 from a uint256 holding 0 silently wrapped around to the maximum value instead of failing. An attacker with a zero balance could withdraw and suddenly hold an astronomical amount. Solidity 0.8 reverts on overflow and underflow by default, which is why SafeMath is now largely unnecessary.",
  },
  {
    key: "exceeds its maximum storage size and wraps back",
    title: "Overflow",
    body: "The mirror image of underflow. Add past a type's maximum and it wraps to zero. The danger is that it fails silently: no revert, no error, just a number that is now wrong, and every calculation built on it is wrong too.",
  },
  {
    key: "custom named permissions instead of a single owner",
    title: "AccessControl",
    body: "OpenZeppelin's role-based alternative to Ownable. Instead of one all-powerful owner you define roles such as MINTER_ROLE or PAUSER_ROLE and grant each to different addresses. This gives you least privilege: a compromised minter key cannot pause the contract or drain funds.",
  },
  {
    key: "missing permission checks on a sensitive function",
    title: "Access control",
    body: "Consistently one of the most damaging categories in real audits, and one of the dullest to find. It is rarely a clever exploit. It is usually a function that should have had a modifier and did not, so anyone can call it. The fix is boring and the loss is not.",
  },
  {
    key: "initializer before the legitimate deployer",
    title: "Uninitialized proxy",
    body: "Upgradeable contracts cannot use constructors, so they use an initializer function that must be called manually after deployment. If deployment and initialization are separate transactions, an attacker can slip in between and call the initializer first, making themselves the owner. Always initialize atomically in the same transaction as deployment.",
  },
  {
    key: "risky default for functions in versions before Solidity 0.5",
    title: "public by default",
    body: "Before Solidity 0.5, a function with no visibility keyword was public. Forgetting one word exposed internal logic to the entire world. The 2017 Parity multisig incident traced back to exposed initialization. Solidity now requires explicit visibility, which is a good example of a language change made specifically to prevent a class of bug.",
  },
  {
    key: "12 or 24 word backup",
    title: "Seed phrase",
    body: "A human-readable encoding, defined by BIP-39, of the entropy every key in your wallet derives from. It is not a password protecting an account somewhere: it *is* the account. Anyone who reads it controls the funds permanently, which is why no legitimate service will ever ask for it.",
  },
  {
    key: "never connected to the internet",
    title: "Cold wallet",
    body: "Keys held on a device that never touches the internet, so remote malware has no path to reach them. The trade-off is convenience: cold storage suits holdings you rarely move, while a hot wallet suits daily use. Most people should use both and keep the larger balance cold.",
  },
  {
    key: "fake but convincing website",
    title: "Phishing",
    body: "The most successful attack in crypto by volume, and it needs no code. A convincing clone of a real site asks you to connect and sign. In modern variants you are not even asked for your seed phrase, just to approve a transaction whose payload grants unlimited token spending. Always read what you are signing, not just who is asking.",
  },
  {
    key: "without ever exposing the private key to the connected computer",
    title: "Hardware wallet",
    body: "The private key never leaves a dedicated secure chip. The computer sends an unsigned transaction to the device, you confirm on the device's own screen, and only the signature comes back. Even a fully compromised computer cannot extract the key, which is why the on-device screen matters: it shows you what you are actually signing.",
  },
  {
    key: "between someone else's transaction and its confirmation",
    title: "Front-running",
    body: "Pending transactions sit in a public mempool before they are mined. Anyone can read yours, submit the same trade with a higher gas price, and be mined first. This is the foundation of MEV, and the sandwich attack is its most common form: buy ahead of you, let your trade move the price, sell straight after.",
  },
  {
    key: "borrowing a huge sum with no collateral",
    title: "Flash loan",
    body: "Borrow millions with nothing down, on the single condition that you repay within the same transaction, otherwise everything reverts as though it never happened. It is a legitimate primitive for arbitrage, but it also means any attacker can temporarily command enormous capital. Never assume an exploit is out of reach because it needs a large balance.",
  },
  {
    key: "temporarily distort an asset's price",
    title: "Oracle manipulation",
    body: "If a protocol reads its price from a single on-chain pool, that price can be moved by trading in that pool, often with a flash loan. The attacker distorts the price, borrows or liquidates against the false valuation, then restores it within one transaction. The defence is time-weighted averages or a decentralised oracle network, never a single spot price.",
  },
  {
    key: "reliable external data like price feeds",
    title: "Oracle",
    body: "Contracts cannot make network calls, so they cannot see anything off-chain by themselves. An oracle publishes external data on-chain for them to read. That makes it a trust boundary and a single point of failure, which is why serious protocols use decentralised feeds with multiple independent reporters.",
  },
  {
    key: "systematic review of smart contract code",
    title: "Audit",
    body: "A structured review by security engineers before deployment, combining manual reading with automated tooling. Worth being precise about what it is not: an audit is a snapshot of one commit, not a guarantee. Audited protocols are exploited regularly, usually through logic the auditors were never shown or changes made afterwards.",
  },
  {
    key: "pays independent researchers for responsibly disclosing",
    title: "Bug bounty",
    body: "A standing offer to pay anyone who reports a vulnerability privately instead of exploiting it. It works by economics: make honest disclosure more attractive than the exploit. Large protocols post seven-figure bounties for critical findings precisely because the alternative costs far more.",
  },
  {
    key: "static-analysis tool (from Trail of Bits)",
    title: "Slither",
    body: "A static analyser that parses Solidity into an intermediate representation and matches it against detectors for known vulnerability patterns. It runs in seconds and catches a large share of common issues, which makes it the right first pass. It cannot understand what your protocol is supposed to do, so it will never find a business logic flaw.",
  },
  {
    key: "cannot be changed or upgraded after deployment",
    title: "Immutable",
    body: "Code that cannot be altered once deployed. This is a genuine trade-off rather than a virtue. Immutability means nobody, including the developer, can rug you or change the rules, and it also means a discovered bug can never be fixed. Upgradeable contracts solve that and introduce a new question: who holds the upgrade key.",
  },
];

function bare(text) {
  return String(text || "").replace(/^\[[^\]]+\]\s*/, "");
}

export function explanationFor(questionText) {
  const t = bare(questionText).toLowerCase();
  return EXPLANATIONS.find((e) => t.includes(e.key.toLowerCase())) || null;
}
