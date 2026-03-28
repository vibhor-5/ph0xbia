/* ──────────────────────────────────────────────────────────────────────
 *  Wagmi + RainbowKit Config — Monad Testnet
 * ────────────────────────────────────────────────────────────────────── */
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: { name: 'MonadScan', url: 'https://testnet.monadscan.com' },
  },
  testnet: true,
});

export const wagmiConfig = getDefaultConfig({
  appName: 'PH0xBIA — Ashworth Asylum',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '1c79f90cf2c6248b1d9bf5c02b8dff2f', // Public dummy fallback
  chains: [monadTestnet],
  ssr: true,
});
