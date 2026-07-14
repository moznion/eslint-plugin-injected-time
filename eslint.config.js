"use strict";

// Load the build artifact (JS compiled from strict TS).
const injectedTime = require("./dist");
const tseslint = require("typescript-eslint");

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  {
    files: ["**/*.js", "**/*.ts"],
    languageOptions: {
      // Use the TypeScript parser so that .ts files can be parsed.
      parser: tseslint.parser,
    },
    plugins: {
      // Namespace "injected-time" (kept in sync with oxlint's meta.name).
      "injected-time": injectedTime,
    },
    rules: {
      // Example option: to also forbid Date.now() in default parameters, use
      //   ["error", { allowInDefaultParameters: false }]
      "injected-time/no-ambient-date-now": "error",
    },
  },
];
