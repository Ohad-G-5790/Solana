"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Reconnecting, useBandSession } from "@/components/BandSession";
import { ConnectScreen, RegisterBand } from "@/components/Connect";
import { WalletPanel } from "@/components/WalletPanel";
import { CLUSTER } from "@/lib/config";

/**
 * Where a wallet with no band profile lands: the band pages send it here, and
 * once the profile exists on-chain it goes on to its dashboard.
 */
export default function SetupPage() {
  const session = useBandSession();
  const router = useRouter();
  const ready = !!session.wallet && !!session.profile;
  useEffect(() => {
    if (ready) router.replace("/");
  }, [ready, router]);

  if (!session.wallet) return session.reconnecting ? <Reconnecting /> : <ConnectScreen />;
  if (session.profile === undefined)
    return (
      <p className="muted">
        {session.profileError ? `${CLUSTER} is busy, so reading your wallet takes a moment. This page keeps trying by itself.` : "Reading your wallet…"}
      </p>
    );
  if (session.profile) return <p className="muted">Opening your dashboard…</p>;
  return (
    <>
      <WalletPanel />
      <RegisterBand />
    </>
  );
}
