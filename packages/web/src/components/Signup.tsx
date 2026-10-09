"use client";

import { useState, type FormEvent } from "react";
import { SIGNUP_URL } from "@/lib/config";

/**
 * The email sign-up for the full release. The site is static, so the address
 * goes to a form endpoint (SIGNUP_URL): the Google Sheet's Apps Script web app
 * (scripts/signup-sheet.gs) or any service that takes a POSTed `email` field,
 * e.g. Formspree. Without one, nothing renders.
 */
export function SignupForm({ big = false, source = "greenroom-demo" }: { big?: boolean; source?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!SIGNUP_URL || state === "sending") return;
    setState("sending");
    try {
      const body = new URLSearchParams({ email, source });
      if (/script\.google\.com/.test(SIGNUP_URL)) {
        // a Google Apps Script web app answers through a redirect the browser
        // will not let a page read; the row is written all the same, so a sent request counts
        await fetch(SIGNUP_URL, { method: "POST", mode: "no-cors", body });
        setState("done");
      } else {
        const r = await fetch(SIGNUP_URL, { method: "POST", headers: { Accept: "application/json" }, body });
        setState(r.ok ? "done" : "error");
      }
    } catch {
      setState("error");
    }
  };

  if (!SIGNUP_URL) return null;
  if (state === "done")
    return (
      <p className={`signup-done ${big ? "" : "small"}`} role="status">
        <b>Thanks!</b> We will email you when the full version is out.
      </p>
    );
  return (
    <form className={big ? "signup big" : "signup"} onSubmit={submit}>
      <input
        className="input"
        type="email"
        required
        placeholder="you@yourband.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label="Your email"
        autoComplete="email"
      />
      <button className={big ? "btn primary big" : "btn outline small"} disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Notify me"}
      </button>
      {state === "error" ? <span className="micro bad">That did not go through; try again.</span> : null}
    </form>
  );
}
