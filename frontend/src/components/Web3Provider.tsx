'use client';
/* ──────────────────────────────────────────────────────────────────────
 *  Web3 Providers — wagmi + RainbowKit + React Query
 * ────────────────────────────────────────────────────────────────────── */
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wagmi';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

const horrorTheme = darkTheme({
  accentColor: '#8b0000',
  accentColorForeground: '#f5f0e1',
  borderRadius: 'small',
  fontStack: 'system',
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={horrorTheme}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
