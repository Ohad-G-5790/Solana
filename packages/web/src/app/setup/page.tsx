"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Reconnecting, useBandSession } from "@/components/BandSession";
import { ConnectScreen, RegisterBand, RegisterVenue, RoleChoice } from "@/components/Connect";
import { WalletPanel } from "@/components/WalletPanel";
import { CLUSTER } from "@/lib/config";

/**
 * Where a new wallet lands: first "artist or venue?", then that profile's
 * form. Once a profile exists on-chain it goes on to its home: the band
 * dashboard or the venue page.
 */
export default function SetupPage() {
  const session = useBandSession();
  const router = useRouter();
  const [role, setRole] = useState<"artist" | "venue" | null>(null);
  const target = !session.wallet ? null : session.profile ? "/" : session.venue ? "/venue" : null;
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (!session.wallet) return session.reconnecting ? <Reconnecting /> : <ConnectScreen />;
  if (session.profile === undefined || session.venue === undefined)
    return (
      <p className="muted">
        {session.profileError ? `${CLUSTER} is busy, so reading your wallet takes a moment. This page keeps trying by itself.` : "Reading your wallet…"}
      </p>
    );
  if (target) return <p className="muted">{target === "/" ? "Opening your dashboard…" : "Opening your venue…"}</p>;
  return (
    <>
      <WalletPanel />
      {role === null ? (
        <RoleChoice onPick={setRole} />
      ) : role === "artist" ? (
        <RegisterBand onBack={() => setRole(null)} />
      ) : (
        <RegisterVenue onBack={() => setRole(null)} />
      )}
    </>
  );
}
