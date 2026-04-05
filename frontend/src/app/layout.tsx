import type { Metadata } from 'next';
import DesktopBridgeBootstrap from '@/components/DesktopBridgeBootstrap';
import { ThemeProvider } from '@/lib/ThemeContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'CATTO // GLOBAL INTELLIGENCE',
  description: 'Advanced Geopolitical Risk Dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head />
      <body className="antialiased bg-[var(--bg-primary)]" suppressHydrationWarning>
        <ThemeProvider>
          <DesktopBridgeBootstrap />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
