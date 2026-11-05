import { useState } from "react";
import { formatEther } from "ethers";
import { severityForReward, SEVERITY_LABELS, parseQuestionText } from "../lib/contracts";
import { matchAnswer } from "../lib/answer";
import { hintFor } from "../lib/hints";
import { explanationFor } from "../lib/explanations";
import { sound, buzz } from "../lib/feedback";

export default function QuestionCard({ question, connected, onSubmit, onUseHint, hintCredits }) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [note, setNote] = useState(null);
  const [hint, setHint] = useState(null);
  const [showWhy, setShowWhy] = useState(false);

  const severity = severityForReward(question.reward);
  const { category, text } = parseQuestionText(question.text);
  const reward = formatEther(question.reward);
  const available = hintFor(question.text);
  const lesson = explanationFor(question.text);

  async function check(e) {
    e.preventDefault();
    if (!answer.trim() || busy) return;

    // Free local check against the on-chain hash. A wrong answer never costs
    // gas and never resets the on-chain streak.
    const exact = matchAnswer(answer, question.answerHash);

    if (!exact) {
      sound.wrong();
      buzz([40, 60, 40]);
      setShake(true);
      setTimeout(() => setShake(false), 420);
      setNote({
        kind: "bad",
        text: "Not a match. Nothing was sent to the chain, so this cost you nothing. Try another wording.",
      });
      return;
    }

    setShowWhy(true);

    if (!connected) {
      setNote({ kind: "hint", text: "That is the right answer. Connect a wallet to claim the PLAY." });
      return;
    }

    setBusy(true);
    setNote({ kind: "hint", text: "Correct. Confirm in your wallet to claim the reward." });

    try {
      const result = await onSubmit(question.id, exact);
      sound.correct();
      if (result?.bonus) sound.bonus();
      buzz(28);
      setFlash(true);
      setTimeout(() => setFlash(false), 460);
      setNote({
        kind: "ok",
        text: result?.bonus
          ? `Correct, and a streak bonus landed. +${result.reward} PLAY`
          : `Correct. +${result?.reward ?? reward} PLAY`,
      });
      setAnswer("");
    } catch (err) {
      const msg = String(err?.message || err);
      setNote({
        kind: "bad",
        text: msg.includes("cooldown")
          ? "This question is on a 60 second cooldown after your last attempt."
          : msg.includes("already solved")
            ? "You have already solved this one."
            : /reject|denied/i.test(msg)
              ? "You rejected the transaction in your wallet."
              : msg,
      });
    } finally {
      setBusy(false);
    }
  }

  function revealHint() {
    if (!available) return;
    if (!onUseHint()) {
      setNote({ kind: "hint", text: "No hint credits left. Watch an ad on the Home tab to earn one." });
      return;
    }
    sound.tap();
    setHint(available);
  }

  return (
    <article
      className={[
        "q",
        `q--${severity}`,
        question.solvedByCaller ? "q--solved" : "",
        flash ? "q--correct" : "",
      ].join(" ")}
    >
      <div className="q__meta">
        <span className={`sev sev--${severity}`}>{SEVERITY_LABELS[severity]}</span>
        <span className="tag">{category}</span>
        <span className="q__reward">+{reward} PLAY</span>
      </div>

      <p className="q__text">{text}</p>

      {question.solvedByCaller ? (
        <>
          <div className="feedback feedback--ok">Solved. Reward already claimed.</div>
          {lesson && !showWhy && (
            <button
              className="btn btn--outline"
              style={{ marginTop: 10, fontSize: 13, padding: "8px 14px" }}
              onClick={() => {
                sound.tap();
                setShowWhy(true);
              }}
            >
              Why this is the answer
            </button>
          )}
        </>
      ) : (
        <>
          <form className={`answer-row${shake ? " shake" : ""}`} onSubmit={check}>
            <input
              type="text"
              value={answer}
              placeholder="Type your answer"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"
              onChange={(e) => setAnswer(e.target.value)}
              disabled={busy}
            />
            <button className="btn btn--primary" type="submit" disabled={busy || !answer.trim()}>
              {busy ? "…" : "Check"}
            </button>
          </form>

          {available && !hint && (
            <button
              className="btn btn--outline"
              style={{ marginTop: 10, fontSize: 13, padding: "8px 14px" }}
              onClick={revealHint}
            >
              Use a hint ({hintCredits} left)
            </button>
          )}

          {hint && (
            <div className="feedback feedback--hint">
              {hint.clue}
              <div className="faint" style={{ marginTop: 6, fontSize: 12.5 }}>
                Answer shape: {hint.shape}
              </div>
            </div>
          )}

          {note && <div className={`feedback feedback--${note.kind}`}>{note.text}</div>}
        </>
      )}

      {lesson && showWhy && (
        <div className="lesson">
          <h4 className="lesson__title">{lesson.title}</h4>
          <p className="lesson__body">{lesson.body}</p>
        </div>
      )}
    </article>
  );
}
