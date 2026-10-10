import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/Providers";
import { Shell } from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Greenroom",
  description: "AI agents that book concert tours on Solana: escrowed tickets, sell-through thresholds, automatic refunds and settlement.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Wallet extensions need a secure page: send http:// visitors to https:// before anything loads. */}
        <script
          dangerouslySetInnerHTML={{
            __html: String.raw`if(location.protocol==='http:'&&!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)&&!/\.(localhost|test)$/.test(location.hostname)){location.replace('https://'+location.host+location.pathname+location.search+location.hash)}`,
          }}
        />
      </head>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
