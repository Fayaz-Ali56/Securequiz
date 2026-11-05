import { useEffect, useState } from "react";
import { formatEther } from "ethers";
import { parseQuestionText, severityForReward, SEVERITY_LABELS } from "../lib/contracts";
import { dailyPick, nextResetLabel, dayStreak } from "../lib/progress";
import { short } from "./Chrome";
import { sound } from "../lib/feedback";

/* ------------------------------------------------------------------ home -- */

export function HomeView({ questions, stats, rank, hintCredits, onGo, onWatchAd, address, onConnect }) {
  const daily = dailyPick(questions);
  const solved = questions.filter((q) => q.solvedByCaller).length;

  return (
    <div className="shell">
      <div className="view-head">
        <h1>{address ? `Welcome back, ${rank.name}` : "Learn to break contracts"}</h1>
        <p>
          Answer real smart-contract security questions. Every correct answer mints PLAY tokens to
          your wallet on the Sepolia network.
        </p>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat__value" style={{ color: "var(--gold)" }}>{stats.balance}</div>
          <div className="stat__label">PLAY earned</div>
        </div>
        <div className="stat">
          <div className="stat__value">{stats.streak}</div>
          <div className="stat__label">Answer streak</div>
        </div>
        <div className="stat">
          <div className="stat__value">{dayStreak()}</div>
          <div className="stat__label">Day streak</div>
        </div>
      </div>

      <div className="card">
        <div className="meter-head">
          <span>
            Level {rank.level} · {rank.name}
          </span>
          <span className="mono">
            {rank.nextName ? `${rank.xpToNext} XP to ${rank.nextName}` : "Max rank"}
          </span>
        </div>
        <div className="meter">
          <div className="meter__fill meter__fill--gold" style={{ width: `${rank.progress * 100}%` }} />
        </div>
      </div>

      {daily && (
        <div className="daily" style={{ marginTop: 14 }}>
          <div className="daily__eyebrow">
            <span>Daily challenge</span>
            <span className="mono">resets in {nextResetLabel()}</span>
          </div>
          <div className="daily__q">{parseQuestionText(daily.text).text}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className={`sev sev--${severityForReward(daily.reward)}`}>
              {SEVERITY_LABELS[severityForReward(daily.reward)]}
            </span>
            <span className="mono" style={{ color: "var(--gold)", fontSize: 13 }}>
              +{formatEther(daily.reward)} PLAY
            </span>
            <button className="btn btn--primary" style={{ marginLeft: "auto" }} onClick={() => onGo("play")}>
              Play now
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 14 }}>
        <div className="meter-head">
          <span>Questions solved</span>
          <span className="mono">
            {solved} / {questions.length}
          </span>
        </div>
        <div className="meter">
          <div
            className="meter__fill"
            style={{ width: `${questions.length ? (solved / questions.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>Stuck on a question?</h3>
        <p style={{ fontSize: 14.5, marginTop: 6 }}>
          Watch a short ad to earn a hint credit. You have <strong>{hintCredits}</strong>.
        </p>
        <button className="btn btn--ghost btn--block" style={{ marginTop: 12 }} onClick={onWatchAd}>
          Watch ad for a hint
        </button>
      </div>

      {!address && (
        <button className="btn btn--primary btn--block" style={{ marginTop: 14 }} onClick={onConnect}>
          Connect wallet to start earning
        </button>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- leaderboard -- */

export function LeaderboardView({ gameRead, me }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gameRead) return;
    let dead = false;

    async function load() {
      try {
        const provider = gameRead.runner?.provider;
        const latest = await provider.getBlockNumber();

        // Public RPCs cap eth_getLogs ranges, so walk backwards in chunks
        // instead of asking for the whole chain history in one call.
        const CHUNK = 9000;
        const SPAN = 90000;
        const from = Math.max(0, latest - SPAN);
        const events = [];

        for (let start = from; start <= latest; start += CHUNK) {
          const end = Math.min(start + CHUNK - 1, latest);
          try {
            const batch = await gameRead.queryFilter(gameRead.filters.AnswerCorrect(), start, end);
            events.push(...batch);
          } catch {
            // One bad window shouldn't lose the whole board.
          }
        }

        const tally = new Map();
        for (const ev of events) {
          const player = ev.args?.player;
          if (!player) continue;
          const prev = tally.get(player) || { player, solved: 0, earned: 0n, best: 0 };
          prev.solved += 1;
          prev.earned += BigInt(ev.args.reward ?? 0);
          prev.best = Math.max(prev.best, Number(ev.args.newStreak ?? 0));
          tally.set(player, prev);
        }

        const list = [...tally.values()].sort((a, b) => (b.earned > a.earned ? 1 : -1)).slice(0, 25);
        if (!dead) setRows(list);
      } catch (err) {
        if (!dead) setError(err?.message || String(err));
      }
    }

    load();
    return () => {
      dead = true;
    };
  }, [gameRead]);

  return (
    <div className="shell">
      <div className="view-head">
        <h1>Leaderboard</h1>
        <p>Ranked from AnswerCorrect events read straight off the contract. No server involved.</p>
      </div>

      {error && <div className="notice">Could not read the chain history: {error}</div>}
      {!rows && !error && <div className="empty">Reading the blockchain…</div>}
      {rows?.length === 0 && <div className="empty">No answers recorded yet. Be the first.</div>}

      {rows?.map((r, i) => (
        <div key={r.player} className={`rank${r.player.toLowerCase() === me?.toLowerCase() ? " rank--me" : ""}`}>
          <div className="rank__pos">{i + 1}</div>
          <div className="rank__who">
            <div className="rank__addr">{short(r.player)}</div>
            <div className="rank__sub">
              {r.solved} solved · best streak {r.best}
            </div>
          </div>
          <div className="rank__amt">{Number(formatEther(r.earned)).toFixed(1)}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- badges -- */

const MEDALS = ["🥉", "🥈", "🥇", "💎"];

export function BadgesView({ badgeRead, badgeWrite, address, totalCorrect, onToast }) {
  const [tiers, setTiers] = useState(null);
  const [claiming, setClaiming] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    if (!badgeRead) return;
    try {
      const count = Number(await badgeRead.tierCount());
      const list = [];
      for (let i = 0; i < count; i++) {
        const [threshold, name] = await badgeRead.getTierInfo(i);
        list.push({ index: i, threshold: Number(threshold), name, claimed: false });
      }
      if (address) {
        const status = await badgeRead.getClaimStatus(address);
        list.forEach((t, i) => (t.claimed = Boolean(status[i])));
      }
      setTiers(list);
    } catch (err) {
      setError(err?.message || String(err));
    }
  }

  useEffect(() => {
    load();
  }, [badgeRead, address]);

  async function claim(index) {
    if (!badgeWrite) return;
    setClaiming(index);
    try {
      const tx = await badgeWrite.claimBadge(index);
      await tx.wait();
      sound.levelUp();
      onToast("Badge minted to your wallet");
      await load();
    } catch (err) {
      onToast(/reject|denied/i.test(String(err?.message)) ? "Transaction rejected" : "Claim failed");
    } finally {
      setClaiming(null);
    }
  }

  if (!badgeRead) {
    return (
      <div className="shell">
        <div className="view-head">
          <h1>Achievements</h1>
        </div>
        <div className="notice">
          The badge contract address is missing. Add VITE_BADGE_ADDRESS to frontend/.env and rebuild.
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="view-head">
        <h1>Achievements</h1>
        <p>Each badge is an ERC-721 NFT minted to your own wallet when you hit the threshold.</p>
      </div>

      {error && <div className="notice">{error}</div>}
      {!tiers && !error && <div className="empty">Loading badges…</div>}

      {tiers?.map((t) => {
        const earned = totalCorrect >= t.threshold;
        return (
          <div key={t.index} className={`badge${earned ? " badge--earned" : ""}`}>
            <div className="badge__medal">{MEDALS[t.index] ?? "◆"}</div>
            <div className="badge__body">
              <h3>{t.name}</h3>
              <div className="faint" style={{ fontSize: 13 }}>
                {t.claimed
                  ? "Claimed"
                  : earned
                    ? "Unlocked — ready to mint"
                    : `${totalCorrect} / ${t.threshold} correct answers`}
              </div>
              {!t.claimed && !earned && (
                <div className="meter" style={{ marginTop: 8 }}>
                  <div
                    className="meter__fill"
                    style={{ width: `${Math.min(100, (totalCorrect / t.threshold) * 100)}%` }}
                  />
                </div>
              )}
            </div>
            {t.claimed ? (
              <span className="sev sev--low">Owned</span>
            ) : (
              earned && (
                <button
                  className="btn btn--primary"
                  style={{ padding: "9px 14px", fontSize: 14 }}
                  disabled={!badgeWrite || claiming === t.index}
                  onClick={() => claim(t.index)}
                >
                  {claiming === t.index ? "…" : "Mint"}
                </button>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
