import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "src/idl/**", "scripts/**"]),
  {
    rules: {
      // The dashboard polls the chain and the transcript on an interval and
      // sets state from those callbacks; that is the intended pattern here.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
