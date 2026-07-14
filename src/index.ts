/**
 * @fileoverview The `eslint-plugin-injected-time` plugin.
 * Written so it can be loaded by both ESLint (flat config) and oxlint (jsPlugins).
 */

import type { TSESLint } from "@typescript-eslint/utils";
import { noAmbientDateNow } from "./rules/no-ambient-date-now";

// Node's CommonJS `require`, declared locally so we don't need `@types/node` just for this.
declare function require(moduleId: string): unknown;

// Single source of truth for the version: read it from package.json at runtime instead
// of hard-coding it here. The compiled `dist/index.js` sits one level below the package
// root, so `../package.json` resolves correctly both locally and when installed from npm.
const { version } = require("../package.json") as { version: string };

const plugin = {
  meta: {
    name: "injected-time",
    version,
  },
  rules: {
    "no-ambient-date-now": noAmbientDateNow,
  },
} satisfies TSESLint.FlatConfig.Plugin;

// Use `export =` so that `require("@moznion/eslint-plugin-injected-time")` returns the
// plugin directly (matching how the ESLint / oxlint config files load it).
export = plugin;
