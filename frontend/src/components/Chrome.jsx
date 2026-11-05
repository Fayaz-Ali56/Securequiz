import { useEffect, useMemo, useState } from "react";
import { sound } from "../lib/feedback";

export function short(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

export function TopBar({ balance, address, onMenu, onConnect, connecting }) {
  return (
    <header className="topbar">
      <button className="iconbtn" onClick={onMenu} aria-label="Open menu">
        ☰
      </button>
      <div className="topbar__brand">
        Secure<span>Quiz</span>
      </div>
      {address ? (
        <div className="coin" title="Your PLAY balance">
          <span className="coin__dot" />
          {balance}
        </div>
      ) : (
        <button className="btn btn--primary" style={{ padding: "9px 15px", fontSize: 14 }} onClick={onConnect} disabled={connecting}>
          {connecting ? "Connecting…" : "Connect wallet"}
        </button>
      )}
    </header>
  );
}

const NAV = [
  { id: "home", label: "Home", icon: "◈" },
  { id: "play", label: "Play", icon: "▶" },
  { id: "ranks", label: "Ranks", icon: "▲" },
  { id: "badges", label: "Badges", icon: "◆" },
];

export function BottomNav({ view, onGo }) {
  return (
    <nav className="bottomnav">
      {NAV.map((n) => (
        <button
          key={n.id}
          className={`navitem${view === n.id ? " navitem--on" : ""}`}
          onClick={() => {
            sound.tap();
            onGo(n.id);
          }}
        >
          <span className="navitem__icon">{n.icon}</span>
          {n.label}
        </button>
      ))}
    </nav>
  );
}

const MENU = [
  { id: "home", label: "Home", icon: "◈" },
  { id: "play", label: "Play", icon: "▶" },
  { id: "ranks", label: "Leaderboard", icon: "▲" },
  { id: "badges", label: "Achievements", icon: "◆" },
  { id: "how", label: "How to play", icon: "?" },
  { id: "rules", label: "Rules and rewards", icon: "§" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export function Drawer({ open, view, address, rank, onGo, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer__id">
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            {address ? rank.name : "Not connected"}
          </div>
          <div className="mono faint" style={{ fontSize: 13, marginTop: 3 }}>
            {address ? short(address) : "Connect to save progress"}
          </div>
        </div>

        {MENU.map((m) => (
          <button
            key={m.id}
            className={`drawer__item${view === m.id ? " drawer__item--on" : ""}`}
            onClick={() => {
              sound.tap();
              onGo(m.id);
              onClose();
            }}
          >
            <span style={{ width: 18, textAlign: "center", color: "var(--gold)" }}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </aside>
    </>
  );
}

export function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [message, onDone]);

  if (!message) return null;
  return <div className="toast">{message}</div>;
}

export function Confetti({ onDone }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        duration: 1.5 + Math.random() * 1.1,
        color: ["#ffb84d", "#48e5a0", "#64c7f0", "#ff9052"][i % 4],
      })),
    []
  );

  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return bits.map((b) => (
    <span
      key={b.id}
      className="confetti-bit"
      style={{
        left: `${b.left}%`,
        background: b.color,
        animationDelay: `${b.delay}s`,
        animationDuration: `${b.duration}s`,
      }}
    />
  ));
}

/** Countdown-driven rewarded ad. Reward is granted only on a full watch. */
export function AdModal({ seconds, onComplete, onCancel }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const done = left <= 0;

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__panel">
        <div className="ad-frame">
          <div className="faint" style={{ fontSize: 12, marginBottom: 10 }}>
            Sponsored placement
          </div>
          <div className="ad-count">{done ? "✓" : left}</div>
          <div className="dim" style={{ fontSize: 14, marginTop: 10 }}>
            {done ? "Reward unlocked" : "Watch to earn a hint credit"}
          </div>
        </div>

        {done ? (
          <button className="btn btn--primary btn--block" onClick={onComplete}>
            Collect reward
          </button>
        ) : (
          <button className="btn btn--outline btn--block" onClick={onCancel}>
            Close without reward
          </button>
        )}
      </div>
    </div>
  );
}
