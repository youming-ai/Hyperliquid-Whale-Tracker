import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { queryClient } from "../lib/api/trpc";
import { wagmiConfig } from "../lib/wagmi";

import "@rainbow-me/rainbowkit/styles.css";

interface ProvidersProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: any;
}

/**
 * App Providers Component
 *
 * Wraps the application with all necessary providers:
 * - WagmiProvider: Ethereum wallet connection
 * - QueryClientProvider: React Query for data fetching
 * - RainbowKitProvider: Wallet connection UI
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#3b82f6",
            accentColorForeground: "white",
            borderRadius: "medium",
          })}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
