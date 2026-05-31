import { useCallback, useEffect, useState } from "react";
import {
  createWalletClient,
  custom,
  type WalletClient,
  type EIP1193Provider,
} from "viem";
import { somniaTestnet } from "./config";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

const CHAIN_ID_HEX = "0x" + somniaTestnet.id.toString(16); // 0xc488

/** Minimal injected-wallet (MetaMask et al.) connection. No external wallet kit. */
export interface WalletState {
  address: `0x${string}` | null;
  connecting: boolean;
  error: string | null;
  hasProvider: boolean;
  connect: () => Promise<void>;
  /** A viem WalletClient bound to the injected provider + connected account. */
  getClient: () => WalletClient | null;
}

/** Ensure the wallet is pointed at Somnia Shannon, adding the chain if unknown. */
async function ensureSomniaChain(provider: EIP1193Provider): Promise<void> {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (err: unknown) {
    // 4902 = chain not added to the wallet yet → add it, then it's selected.
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN_ID_HEX,
          chainName: somniaTestnet.name,
          nativeCurrency: somniaTestnet.nativeCurrency,
          rpcUrls: somniaTestnet.rpcUrls.default.http,
          blockExplorerUrls: [somniaTestnet.blockExplorers!.default.url],
        }],
      });
    } else {
      throw err;
    }
  }
}

export function useInjectedWallet(): WalletState {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasProvider = typeof window !== "undefined" && !!window.ethereum;

  // Reflect account changes (switch / disconnect) from the wallet.
  useEffect(() => {
    const provider = window.ethereum;
    if (!provider?.on) return;
    const onAccounts = (accounts: string[]) =>
      setAddress((accounts[0] as `0x${string}`) ?? null);
    provider.on("accountsChanged", onAccounts);
    return () => provider.removeListener?.("accountsChanged", onAccounts);
  }, []);

  const connect = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) {
      setError("No injected wallet found. Install MetaMask to mint from the browser.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      await ensureSomniaChain(provider);
      setAddress((accounts[0] as `0x${string}`) ?? null);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "Wallet connection failed.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const getClient = useCallback((): WalletClient | null => {
    const provider = window.ethereum;
    if (!provider || !address) return null;
    return createWalletClient({
      account: address,
      chain: somniaTestnet,
      transport: custom(provider),
    });
  }, [address]);

  return { address, connecting, error, hasProvider, connect, getClient };
}
