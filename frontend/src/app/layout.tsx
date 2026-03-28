import type { Metadata } from 'next';
import { Web3Provider } from '@/components/Web3Provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'PH0xBIA — Ashworth Asylum',
  description: 'A psychological horror escape room on Monad. Stake MON. Solve puzzles. Escape before your sanity shatters.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Creepster&family=Inter:wght@300;400;600&family=Share+Tech+Mono&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
