import { readJSON, writeJSON } from "./feedback";

// ---------------------------------------------------------------------------
// Rewarded ads
//
// HONEST STATUS: the provider below is a SIMULATED rewarded ad. It runs a real
// timed watch flow and grants a real reward, but it does not contact an ad
// network and it does not earn money. Settings shows this plainly so the app
// never claims revenue it isn't making.
//
// To switch on real ads you need three things, none of which can be faked from
// here: a Google AdMob account, an app ID + rewarded ad unit ID, and a native
// ad plugin (`npm i @capacitor-community/admob`, then `npx cap sync android`).
// When you have them, implement `showAdMobRewarded` below and flip PROVIDER.
// Everything else in the app - hint credits, XP, the modal, the reward payout -
// already works and needs no changes.
// ---------------------------------------------------------------------------

export const AD_LENGTH_SECONDS = 15;
export const HINT_CREDITS_PER_AD = 1;
export const XP_PER_AD = 25;

const PROVIDER = "simulated"; // change to "admob" once the plugin is installed

const KEY = "sq.ads";

function state() {
  return readJSON(KEY, { credits: 0, watched: 0, lastWatchedAt: 0 });
}

function save(next) {
  writeJSON(KEY, next);
  return next;
}

export function getAdState() {
  return state();
}

export function creditsAvailable() {
  return state().credits;
}

export function spendCredit() {
  const s = state();
  if (s.credits <= 0) return false;
  save({ ...s, credits: s.credits - 1 });
  return true;
}

/** Called when a watch completes. Grants hint credits and XP. */
export function grantAdReward() {
  const s = state();
  const next = save({
    credits: s.credits + HINT_CREDITS_PER_AD,
    watched: s.watched + 1,
    lastWatchedAt: Date.now(),
  });
  return { credits: next.credits, xp: XP_PER_AD };
}

/**
 * Real AdMob path. Left unimplemented on purpose - wiring a fake "success" here
 * would make the app report ad revenue that does not exist.
 */
async function showAdMobRewarded() {
  throw new Error(
    "AdMob is not configured. Install @capacitor-community/admob, add your ad unit ID, then set PROVIDER to \"admob\" in src/lib/ads.js."
  );
}

export function providerName() {
  return PROVIDER;
}

export function isSimulated() {
  return PROVIDER === "simulated";
}

export async function showRewardedAd() {
  if (PROVIDER === "admob") return showAdMobRewarded();
  // The simulated provider is driven by the AdModal component's countdown, so
  // there is nothing to await here - the modal calls grantAdReward on complete.
  return { simulated: true };
}
