"use client";

import { useEffect, useState, type FormEvent } from "react";
import { SIGNUP_URL } from "@/lib/config";

const KEY = "greenroom.demo-notice";

/**
 * "This is a demo version" with an email sign-up for the full release. The
 * site is static, so the address goes to a form service (SIGNUP_URL, any
 * endpoint that takes a POSTed `email` field, e.g. Formspree). Without one the
 * notice still shows, without the form. Closing it hides it for this browser.
 */
export function DemoNotice() {
  const [hidden, setHidden] = useState(true); // until storage is read: no flash for people who closed it
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(KEY) === "closed");
    } catch {
      setHidden(false);
    }
  }, []);

  const close = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(KEY, "closed");
    } catch {
      /* this page view only */
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!SIGNUP_URL || state === "sending") return;
    setState("sending");
    try {
      const r = await fetch(SIGNUP_URL, { method: "POST", headers: { Accept: "application/json" }, body: new URLSearchParams({ email, source: "greenroom-demo" }) });
      setState(r.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  if (hidden) return null;
  return (
    <div className="demo-notice" role="region" aria-label="Demo version">
      <span className="small">
        <b>This is a demo version.</b> {SIGNUP_URL ? "Want the full version once it is out? Leave your email and we will let you know." : "The full version is on its way."}
      </span>
      {SIGNUP_URL ? (
        state === "done" ? (
          <span className="small good">Thanks! We will email you when it is out.</span>
        ) : (
          <form className="row" style={{ gap: 6 }} onSubmit={submit}>
            <input
              className="input"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Your email"
            />
            <button className="btn primary small" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Notify me"}
            </button>
            {state === "error" ? <span className="micro bad">That did not go through; try again.</span> : null}
          </form>
        )
      ) : null}
      <button className="icon-btn" onClick={close} aria-label="Close the demo notice" title="Close">
        ✕
      </button>
    </div>
  );
}
