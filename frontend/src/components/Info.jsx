import { EXPECTED_CHAIN_NAME, GAME_ADDRESS, PLAY_TOKEN_ADDRESS, BADGE_ADDRESS } from "../lib/contracts";
import { isMuted, setMuted } from "../lib/feedback";
import { isSimulated, getAdState } from "../lib/ads";
import { short } from "./Chrome";
import { useState } from "react";

const STEPS = [
  ["Connect a wallet", "Tap Connect wallet. On a phone this opens MetaMask through WalletConnect. Your wallet must be on the Sepolia test network."],
  ["Get some test ETH", "Transactions need gas. Sepolia ETH is free from a faucet and has no real value."],
  ["Pick a question", "Questions are tagged by category and severity. Higher severity pays more PLAY."],
  ["Type your answer", "Spelling is forgiving. \"only owner\", \"onlyOwner\" and \"OnlyOwner\" all count as the same answer."],
  ["Check it for free", "Your answer is verified on your device first. A wrong guess costs no gas and does not break your streak."],
  ["Claim the reward", "When the answer is right, confirm the transaction. The contract mints PLAY straight to your wallet."],
  ["Build a streak", "Every third correct answer in a row pays a 50% bonus. Solve enough and you can mint an achievement NFT."],
];

export function HowToPlayView() {
  return (
    <div className="shell">
      <div className="view-head">
        <h1>How to play</h1>
        <p>Seven steps from a fresh install to your first tokens.</p>
      </div>
      <div className="card">
        {STEPS.map(([title, body], i) => (
          <div className="step" key={title}>
            <div className="step__n">{i + 1}</div>
            <div>
              <h3>{title}</h3>
              <p className="dim" style={{ fontSize: 14.5, marginTop: 4 }}>{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RulesView() {
  return (
    <div className="shell prose">
      <div className="view-head">
        <h1>Rules and rewards</h1>
      </div>

      <div className="card">
        <h3>How rewards are calculated</h3>
        <ul>
          <li>Each question pays a fixed PLAY reward set when it was added on-chain.</li>
          <li>Severity is derived from the reward: Critical pays 20+, High 15+, Medium 10+, Low below 10.</li>
          <li>Every third correct answer in a row pays an extra 50%.</li>
          <li>A question can only be solved once per wallet.</li>
          <li>Each question has a 60 second cooldown between on-chain attempts.</li>
        </ul>

        <h3>What PLAY is worth</h3>
        <p>
          PLAY is a real ERC-20 token, but it lives on the Sepolia test network. Test networks exist
          so developers can work without risking money, so PLAY has no cash value and cannot be sold
          or withdrawn. Everything else about it is real: it is minted by a contract, it sits in your
          wallet, and you can view it on Etherscan.
        </p>

        <h3>Known limitation, stated plainly</h3>
        <p>
          Answers are stored on-chain as keccak256 hashes. The hash is public and the answers are
          short dictionary words, so anyone willing to hash a wordlist offline can recover them. This
          app uses that same property for a good purpose — checking your answer locally so a wrong
          guess costs no gas — but it is a genuine weakness. A production version would use a
          commit-reveal scheme or verify answers off-chain with a signed result.
        </p>

        <h3>Deployed contracts on {EXPECTED_CHAIN_NAME}</h3>
        <ul className="mono" style={{ fontSize: 12.5, listStyle: "none", paddingLeft: 0 }}>
          <li>Game: {GAME_ADDRESS || "not configured"}</li>
          <li>Token: {PLAY_TOKEN_ADDRESS || "not configured"}</li>
          <li>Badges: {BADGE_ADDRESS || "not configured"}</li>
        </ul>
      </div>
    </div>
  );
}

export function SettingsView({ address, chainId, wrongNetwork, onSwitchNetwork }) {
  const [muted, setMutedState] = useState(isMuted());
  const ads = getAdState();

  return (
    <div className="shell">
      <div className="view-head">
        <h1>Settings</h1>
      </div>

      <div className="card">
        <h3>Wallet</h3>
        <p className="mono" style={{ fontSize: 13, marginTop: 6 }}>
          {address ? short(address) : "Not connected"}
        </p>
        <p className="faint" style={{ fontSize: 13 }}>
          Network: {chainId ? `chain ${chainId}` : "unknown"}
          {wrongNetwork ? ` — expected ${EXPECTED_CHAIN_NAME}` : ""}
        </p>
        {wrongNetwork && (
          <button className="btn btn--ghost btn--block" style={{ marginTop: 10 }} onClick={onSwitchNetwork}>
            Switch to {EXPECTED_CHAIN_NAME}
          </button>
        )}
      </div>

      <div className="card">
        <h3>Sound and vibration</h3>
        <button
          className="btn btn--ghost btn--block"
          style={{ marginTop: 10 }}
          onClick={() => setMutedState(setMuted(!muted))}
        >
          {muted ? "Turn sound on" : "Turn sound off"}
        </button>
      </div>

      <div className="card">
        <h3>Ads</h3>
        <p style={{ fontSize: 14.5, marginTop: 6 }}>
          Ads watched: <span className="mono">{ads.watched}</span> · hint credits:{" "}
          <span className="mono">{ads.credits}</span>
        </p>
        {isSimulated() && (
          <div className="notice" style={{ marginTop: 10, marginBottom: 0 }}>
            Ads are running in demo mode. The watch flow and rewards are real, but no ad network is
            connected and no revenue is earned. Wiring up AdMob needs a Google AdMob account and the
            native plugin — see the comments in src/lib/ads.js.
          </div>
        )}
      </div>
    </div>
  );
}
