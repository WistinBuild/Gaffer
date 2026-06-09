import { useChainId, useSwitchChain } from "wagmi";
import { activeChain } from "@/lib/chains";

/**
 * Guard every on-chain write against being signed on the wrong network.
 * The whole dApp targets a single chain (`activeChain`, Base Sepolia by default);
 * if the wallet is on any other chain, approve/mint/stake txs would be submitted
 * to the wrong place — wasting gas and granting allowances against contracts that
 * don't exist there.
 *
 * Returns:
 *  - wrongChain: true when the wallet's chain != activeChain (use to disable/label buttons)
 *  - ensureChain(): switches the wallet to activeChain (throws if the user rejects).
 *    Call `await ensureChain()` before any ensureUsdcAllowance / writeContract.
 */
export function useEnsureChain() {
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const wrongChain = chainId !== activeChain.id;

  async function ensureChain() {
    if (chainId === activeChain.id) return;
    await switchChainAsync({ chainId: activeChain.id });
  }

  return { wrongChain, ensureChain, targetChainName: activeChain.name };
}
