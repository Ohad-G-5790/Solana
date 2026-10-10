"use client";

import { useEffect, useState } from "react";
import { BASE_PATH, SIGNUP_URL } from "@/lib/config";
import { SignupForm } from "./Signup";

const KEY = "greenroom.demo-notice";

/**
 * Inside the app: a slim "This is a demo version" bar with the email sign-up
 * (the landing page carries the big one). Closing it hides it for this browser.
 */
export function DemoNotice() {
  const [hidden, setHidden] = useState(true); // until storage is read: no flash for people who closed it

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

  if (hidden) return null;
  return (
    <div className="demo-notice" role="region" aria-label="Demo version">
      <span className="small">
        <b>This is a demo version.</b>{" "}
        <span className="notice-detail">{SIGNUP_URL ? "Want the full version once it is out? Leave your email and we will let you know." : "The full version is on its way."}</span>
      </span>
      <SignupForm />
      {/* on a phone the form folds away: one line and a link to the sign-up */}
      <a className="demo-notice-link" href={`${BASE_PATH}/home#signup`}>
        Get updates
      </a>
      <button className="icon-btn" onClick={close} aria-label="Close the demo notice" title="Close">
        ✕
      </button>
    </div>
  );
}
