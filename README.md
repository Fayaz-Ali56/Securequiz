# SecureQuiz

A blockchain-based smart contract security education game. Players answer
questions about real vulnerability classes; correct answers are rewarded with
ERC-20 tokens minted directly by a smart contract, and sustained progress earns
non-transferable ERC-721 credential badges with artwork generated on-chain.

Built as a final project for a Blockchain Security course. There is no server
and no database — all game state lives on the Ethereum Sepolia test network.

## Contents

### Smart contracts (`contracts/`)
- `PlayToken.sol` — ERC-20 reward token. Minting is restricted to a single
  authorised address, set to the game contract after deployment.
- `SecurityQuizGame.sol` — game logic. Answers are stored as keccak256 hashes,
  never plaintext. Includes reentrancy guard, Checks-Effects-Interactions
  ordering, per-question cooldown, pausable emergency stop and owner-only
  question management.
- `SecureQuizBadge.sol` — soulbound ERC-721 credentials at four thresholds.
  Transfers between wallets revert. `tokenURI` generates the SVG artwork inside
  the contract and returns it as a base64 data URI, so there is no IPFS pin and
  no image host.
- `contracts/test/MaliciousReentrantToken.sol` — test-only mock used to prove
  the reentrancy guard actually works.

### Tests (`test/`)
- `SecurityQuizGame.test.js` — reward payout, streak bonus, double-claim
  rejection, cooldown enforcement, and a reentrancy attack proof.
- `SecureQuizBadge.test.js` — eligibility, double-claim rejection, and the
  soulbound transfer restriction.

### Scripts (`scripts/`)
- `deploy.js` — deploys the token and game, wires minting authority, seeds the
  starter questions.
- `deploy-badge.js` — deploys the badge contract against an existing game.
- `seed-more-questions.js` — adds the remaining question set.
- `rotate-question.js` — deactivates a question by id.

### Mobile application (`frontend/`)
React 18 + ethers.js v6, built with Vite and packaged for Android with
Capacitor. Wallet connectivity via WalletConnect v2.

Notable modules:
- `src/lib/answer.js` — generates candidate spellings of the player's input and
  hashes each locally against the on-chain answer hash, so a wrong answer costs
  no gas and correct answers are not rejected on formatting.
- `src/lib/explanations.js` — the explanation shown after each question is
  solved, so the app teaches rather than only testing.
- `src/lib/contracts.js` — ABIs and address configuration.

## Setup

```bash
npm install
cp .env.example .env          # then fill in the values
cd frontend && npm install
cp .env.example .env          # then fill in the deployed addresses
```

Both `.env` files are excluded from this archive. `.env.example` in each
location lists the variables required.

## Commands

From the project root:

```bash
npm run compile               # compile contracts
npm test                      # run the full test suite
npm run deploy:sepolia        # deploy token + game
npm run deploy-badge:sepolia  # deploy the badge contract
npm run seed-more:sepolia     # add the remaining questions
```

From `frontend/`:

```bash
npm run dev                   # development server
npm run build                 # production build
npx cap sync android          # copy the build into the Android project
npx cap open android          # open in Android Studio
```

Note: Vite inlines `VITE_*` variables at build time. If `frontend/.env` is
absent when `npm run build` runs, the bundle is produced with empty contract
addresses and the app will load but do nothing. Verify after building:

```bash
grep -c "<your game address>" dist/assets/index-*.js
```

## Deployed contracts (Sepolia, chain ID 11155111)

| Contract | Address |
| --- | --- |
| PlayToken | `0xA420A694f160D4D864E1e11C7D161D8C087AAaDb` |
| SecurityQuizGame | `0x9F5dF19F72bA09659cD7FF22c5131C0E12dB16f4` |
| SecureQuizBadge | `0x44DCb803822872387e4B7AA83f190dAC2b7b01dC` |

Twenty-six questions are stored on-chain, of which twenty-five are active. One
was deactivated after deployment because its stored answer used mixed case and
was therefore unreachable through the normalising client.

## On real-world value

The tokens issued by this project are deployed on a test network and hold no
monetary value. This was a deliberate decision for two independent reasons,
set out in full in Section 9 of the project report.

First, the security review in Section 6 identified that the stored answer
hashes are publicly readable and the answers are low-entropy dictionary words,
so the full answer set can be recovered offline. A reward pool holding assets
of real value would be drained.

Second, issuing a redeemable virtual asset in Pakistan requires a licence from
PVARA under the Virtual Assets Act 2026, with criminal penalties for unlicensed
operation.

Remediating the first is a prerequisite for any deployment carrying real value.
A commit-reveal scheme with per-question salts is the appropriate fix.
