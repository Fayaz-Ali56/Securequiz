import { EthereumProvider } from "@walletconnect/ethereum-provider";
import { EXPECTED_CHAIN_ID } from "./contracts";

// Get a free project ID at https://cloud.reown.com (formerly cloud.walletconnect.com)
const PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";

let providerPromise = null;

export function isWalletConnectConfigured() {
  return Boolean(PROJECT_ID);
}

// Reused across the app - WalletConnect only wants one provider instance.
export function getWalletConnectProvider() {
  if (!providerPromise) {
    providerPromise = EthereumProvider.init({
      projectId: PROJECT_ID,
      chains: [EXPECTED_CHAIN_ID],
      showQrModal: true,
      metadata: {
        name: "SecureQuiz",
        description: "Answer security questions, earn PLAY",
        url: "https://securequiz.app",
        icons: [],
      },
    });
  }
  return providerPromise;
}
