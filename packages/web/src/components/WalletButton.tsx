"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState, type ReactNode } from "react";

/**
 * The wallet button reads the remembered wallet from browser storage on its
 * first render, so it cannot match the server's HTML: render it after mount.
 */
export function WalletButton({ children }: { children?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="btn primary" aria-hidden style={{ visibility: "hidden" }}>{children ?? "Select wallet"}</span>;
  return <WalletMultiButton>{children}</WalletMultiButton>;
}
