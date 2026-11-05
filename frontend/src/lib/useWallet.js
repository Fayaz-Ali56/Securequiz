import { useState, useEffect, useCallback } from "react";
import { BrowserProvider } from "ethers";
import { EXPECTED_CHAIN_ID, EXPECTED_CHAIN_NAME } from "./contracts";
import { FALLBACK_RPC_URL } from "./rpc";
import { getWalletConnectProvider, isWalletConnectConfigured } from "./walletconnect";

export function useWallet() {
  const [address, setAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [rawProvider, setRawProvider] = useState(null); // the EIP-1193 object actually in use

  const hasInjectedWallet = typeof window !== "undefined" && Boolean(window.ethereum);
  // Whether SOME connection method is available at all (extension OR WalletConnect).
  const hasWallet = hasInjectedWallet || isWalletConnectConfigured();

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      let eip1193Provider;
      if (hasInjectedWallet) {
        // Desktop browser with MetaMask (or similar) installed as an extension.
        eip1193Provider = window.ethereum;
      } else if (isWalletConnectConfigured()) {
        // Native app / mobile browser with no injected extension - use WalletConnect
        // to link to a wallet app (like MetaMask Mobile) instead.
        const wcProvider = await getWalletConnectProvider();
        await wcProvider.connect();
        eip1193Provider = wcProvider;
      } else {
        setError("No wallet found. Install MetaMask to play.");
        setConnecting(false);
        return;
      }

      const browserProvider = new BrowserProvider(eip1193Provider);
      const accounts = await browserProvider.send("eth_requestAccounts", []);
      const network = await browserProvider.getNetwork();
      const currentSigner = await browserProvider.getSigner();

      setRawProvider(eip1193Provider);
      setProvider(browserProvider);
      setSigner(currentSigner);
      setAddress(accounts[0]);
      setChainId(Number(network.chainId));
    } catch (err) {
      setError(err.message || "Couldn't connect wallet.");
    } finally {
      setConnecting(false);
    }
  }, [hasInjectedWallet]);

  useEffect(() => {
    if (!rawProvider) return;

    const handleAccountsChanged = (accounts) => {
      setAddress(accounts.length > 0 ? accounts[0] : null);
    };
    const handleChainChanged = (newChainId) => {
      setChainId(Number(newChainId));
    };
    const handleDisconnect = () => {
      setAddress(null);
      setRawProvider(null);
      setProvider(null);
      setSigner(null);
    };

    rawProvider.on("accountsChanged", handleAccountsChanged);
    rawProvider.on("chainChanged", handleChainChanged);
    rawProvider.on("disconnect", handleDisconnect);
    return () => {
      rawProvider.removeListener?.("accountsChanged", handleAccountsChanged);
      rawProvider.removeListener?.("chainChanged", handleChainChanged);
      rawProvider.removeListener?.("disconnect", handleDisconnect);
    };
  }, [rawProvider]);

  const switchNetwork = useCallback(async () => {
    if (!rawProvider) return;
    const hexChainId = "0x" + EXPECTED_CHAIN_ID.toString(16);
    try {
      await rawProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChainId }] });
    } catch (err) {
      // 4902 = chain not added to the wallet yet
      if (err.code === 4902) {
        try {
          await rawProvider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hexChainId,
                chainName: EXPECTED_CHAIN_NAME,
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: FALLBACK_RPC_URL ? [FALLBACK_RPC_URL] : [],
              },
            ],
          });
        } catch (addErr) {
          setError(addErr.message || "Couldn't add the network.");
        }
      } else {
        setError(err.message || "Couldn't switch network.");
      }
    }
  }, [rawProvider]);

  return { address, provider, signer, chainId, error, connecting, hasWallet, connect, switchNetwork };
}
