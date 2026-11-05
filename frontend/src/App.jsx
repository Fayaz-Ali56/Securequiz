import { useState, useEffect, useMemo, useCallback } from "react";
import { Contract, ethers } from "ethers";
import { useWallet } from "./lib/useWallet";
import {
  GAME_ADDRESS,
  PLAY_TOKEN_ADDRESS,
  BADGE_ADDRESS,
  GAME_ABI,
  PLAY_TOKEN_ABI,
  BADGE_ABI,
  EXPECTED_CHAIN_ID,
  EXPECTED_CHAIN_NAME,
  parseQuestionText,
} from "./lib/contracts";
import { FALLBACK_RPC_URL } from "./lib/rpc";
import { TopBar, BottomNav, Drawer, Toast, Confetti, AdModal } from "./components/Chrome";
import QuestionCard from "./components/QuestionCard";
import { HomeView, LeaderboardView, BadgesView } from "./components/Views";
import { HowToPlayView, RulesView, SettingsView } from "./components/Info";
import { sound } from "./lib/feedback";
import { AD_LENGTH_SECONDS, creditsAvailable, spendCredit, grantAdReward } from "./lib/ads";
import { totalXp, rankFor, addBonusXp, recordVisit } from "./lib/progress";

export default function App() {
  const { address, provider, signer, chainId, error: walletError, connecting, connect, switchNetwork } = useWallet();

  const [view, setView] = useState("home");
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState(null);
  const [confetti, setConfetti] = useState(false);
  const [adOpen, setAdOpen] = useState(false);
  const [credits, setCredits] = useState(creditsAvailable());

  const [balance, setBalance] = useState("0");
  const [streak, setStreak] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);

  const [questions, setQuestions] = useState([]);
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    recordVisit();
  }, []);

  // Reads always go through the RPC URL, never the wallet. That way questions
  // load even when the wallet sits on the wrong network or isn't connected.
  const readProvider = useMemo(
    () => (FALLBACK_RPC_URL ? new ethers.JsonRpcProvider(FALLBACK_RPC_URL) : provider),
    [provider]
  );

  const gameRead = useMemo(
    () => (readProvider && GAME_ADDRESS ? new Contract(GAME_ADDRESS, GAME_ABI, readProvider) : null),
    [readProvider]
  );
  const gameWrite = useMemo(
    () => (signer && GAME_ADDRESS ? new Contract(GAME_ADDRESS, GAME_ABI, signer) : null),
    [signer]
  );
  const tokenRead = useMemo(
    () => (readProvider && PLAY_TOKEN_ADDRESS ? new Contract(PLAY_TOKEN_ADDRESS, PLAY_TOKEN_ABI, readProvider) : null),
    [readProvider]
  );
  const badgeRead = useMemo(
    () => (readProvider && BADGE_ADDRESS ? new Contract(BADGE_ADDRESS, BADGE_ABI, readProvider) : null),
    [readProvider]
  );
  const badgeWrite = useMemo(
    () => (signer && BADGE_ADDRESS ? new Contract(BADGE_ADDRESS, BADGE_ABI, signer) : null),
    [signer]
  );

  const wrongNetwork = Boolean(chainId) && chainId !== EXPECTED_CHAIN_ID;
  const rank = rankFor(totalXp(totalCorrect));

  // ---------------------------------------------------------------- load ---

  const loadQuestions = useCallback(async () => {
    if (!gameRead) {
      setLoadError(
        "No contract address configured. Check that frontend/.env exists and was present when you ran npm run build."
      );
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const count = Number(await gameRead.questionCount());
      const raw = await Promise.all(Array.from({ length: count }, (_, i) => gameRead.questions(i)));
      const solved = address
        ? await Promise.all(Array.from({ length: count }, (_, i) => gameRead.hasAnswered(address, i)))
        : new Array(count).fill(false);

      const list = [];
      for (let i = 0; i < count; i++) {
        if (!raw[i].active) continue;
        list.push({
          id: i,
          text: raw[i].text,
          answerHash: raw[i].answerHash,
          reward: BigInt(raw[i].reward || 0),
          solvedByCaller: Boolean(solved[i]),
        });
      }
      setQuestions(list);
    } catch (err) {
      console.error("Question load failed:", err);
      setLoadError(`Couldn't load questions: ${err?.message ?? err}`);
    } finally {
      setLoading(false);
    }
  }, [gameRead, address]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    if (!address || !tokenRead || !gameRead) return;
    let dead = false;

    async function refresh() {
      try {
        const [bal, s, tc] = await Promise.all([
          tokenRead.balanceOf(address),
          gameRead.streak(address),
          gameRead.totalCorrect(address),
        ]);
        if (dead) return;
        setBalance(Number(ethers.formatEther(bal)).toFixed(1));
        setStreak(Number(s));
        setTotalCorrect(Number(tc));
      } catch (err) {
        console.error("Balance refresh failed:", err);
      }
    }

    refresh();
    const t = setInterval(refresh, 8000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [address, tokenRead, gameRead]);

  // -------------------------------------------------------------- actions ---

  const submitAnswer = useCallback(
    async (questionId, exactAnswer) => {
      if (!gameWrite) throw new Error("Connect a wallet first");
      if (wrongNetwork) throw new Error(`Switch your wallet to ${EXPECTED_CHAIN_NAME} first`);

      const before = await gameRead.streak(address);
      const tx = await gameWrite.submitAnswer(questionId, exactAnswer);
      const receipt = await tx.wait();

      let reward = null;
      let bonus = false;
      for (const log of receipt.logs) {
        try {
          const parsed = gameRead.interface.parseLog(log);
          if (parsed?.name === "AnswerCorrect") {
            reward = ethers.formatEther(parsed.args.reward);
            bonus = Number(parsed.args.newStreak) % 3 === 0;
          }
        } catch {
          // Logs from the token contract don't parse against this ABI.
        }
      }

      setQuestions((qs) => qs.map((q) => (q.id === questionId ? { ...q, solvedByCaller: true } : q)));
      if (bonus) setConfetti(true);
      sound.coin();
      void before;
      return { reward, bonus };
    },
    [gameWrite, gameRead, address, wrongNetwork]
  );

  const useHint = useCallback(() => {
    if (!spendCredit()) return false;
    setCredits(creditsAvailable());
    return true;
  }, []);

  const finishAd = useCallback(() => {
    const { credits: next, xp } = grantAdReward();
    addBonusXp(xp);
    setCredits(next);
    setAdOpen(false);
    sound.reward();
    setToast(`Hint credit earned · +${xp} XP`);
  }, []);

  // ----------------------------------------------------------------- view ---

  const categories = useMemo(() => {
    const set = new Set(questions.map((q) => parseQuestionText(q.text).category));
    return ["All", ...[...set].sort()];
  }, [questions]);

  const visible = useMemo(
    () => (category === "All" ? questions : questions.filter((q) => parseQuestionText(q.text).category === category)),
    [questions, category]
  );

  const solvedCount = questions.filter((q) => q.solvedByCaller).length;

  function go(next) {
    setView(next);
    window.scrollTo({ top: 0 });
  }

  return (
    <div>
      {confetti && <Confetti onDone={() => setConfetti(false)} />}
      <Toast message={toast} onDone={() => setToast(null)} />
      {adOpen && (
        <AdModal seconds={AD_LENGTH_SECONDS} onComplete={finishAd} onCancel={() => setAdOpen(false)} />
      )}

      <TopBar
        balance={balance}
        address={address}
        connecting={connecting}
        onMenu={() => setDrawer(true)}
        onConnect={connect}
      />

      <Drawer
        open={drawer}
        view={view}
        address={address}
        rank={rank}
        onGo={go}
        onClose={() => setDrawer(false)}
      />

      {walletError && (
        <div className="shell" style={{ paddingBottom: 0 }}>
          <div className="notice">{walletError}</div>
        </div>
      )}

      {wrongNetwork && (
        <div className="shell" style={{ paddingBottom: 0 }}>
          <div className="notice">
            Your wallet is on the wrong network. Questions still load, but claiming rewards needs{" "}
            {EXPECTED_CHAIN_NAME}.
            <button className="btn btn--ghost btn--block" style={{ marginTop: 10 }} onClick={switchNetwork}>
              Switch network
            </button>
          </div>
        </div>
      )}

      {view === "home" && (
        <HomeView
          questions={questions}
          stats={{ balance, streak }}
          rank={rank}
          hintCredits={credits}
          address={address}
          onGo={go}
          onConnect={connect}
          onWatchAd={() => setAdOpen(true)}
        />
      )}

      {view === "play" && (
        <div className="shell">
          <div className="view-head">
            <h1>Findings</h1>
            <p>Each question is a security finding. Higher severity, bigger reward.</p>
          </div>

          {loading && <div className="empty">Reading questions from the contract…</div>}
          {loadError && <div className="notice">{loadError}</div>}

          {!loading && questions.length > 0 && (
            <>
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="meter-head">
                  <span>Progress</span>
                  <span className="mono">
                    {solvedCount} / {questions.length}
                  </span>
                </div>
                <div className="meter">
                  <div className="meter__fill" style={{ width: `${(solvedCount / questions.length) * 100}%` }} />
                </div>
              </div>

              {categories.length > 2 && (
                <div className="chips">
                  {categories.map((c) => (
                    <button
                      key={c}
                      className={`chip${category === c ? " chip--on" : ""}`}
                      onClick={() => {
                        sound.tap();
                        setCategory(c);
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}

              {visible.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  connected={Boolean(address) && !wrongNetwork}
                  onSubmit={submitAnswer}
                  onUseHint={useHint}
                  hintCredits={credits}
                />
              ))}
            </>
          )}

          {!loading && !loadError && questions.length === 0 && (
            <div className="empty">No active questions on the contract yet.</div>
          )}
        </div>
      )}

      {view === "ranks" && <LeaderboardView gameRead={gameRead} me={address} />}

      {view === "badges" && (
        <BadgesView
          badgeRead={badgeRead}
          badgeWrite={badgeWrite}
          address={address}
          totalCorrect={totalCorrect}
          onToast={setToast}
        />
      )}

      {view === "how" && <HowToPlayView />}
      {view === "rules" && <RulesView />}
      {view === "settings" && (
        <SettingsView
          address={address}
          chainId={chainId}
          wrongNetwork={wrongNetwork}
          onSwitchNetwork={switchNetwork}
        />
      )}

      <BottomNav view={view} onGo={go} />
    </div>
  );
}
