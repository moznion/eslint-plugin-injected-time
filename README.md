# @moznion/eslint-plugin-injected-time

[![CI](https://github.com/moznion/eslint-plugin-injected-time/actions/workflows/ci.yml/badge.svg)](https://github.com/moznion/eslint-plugin-injected-time/actions/workflows/ci.yml)

A lint plugin that forces the time to be injected from the outside and forbids reading the current time ambiently via `Date.now()`. It provides the `no-ambient-date-now` rule. The same implementation runs on **both ESLint and oxlint**.

## Why

When logic depends on `Date.now()`, it becomes tightly coupled to the ambient state and behaves nondeterministically. It also cannot fix the clock in tests, which hurts testability. If you need the time, **inject it as an argument** — this rule enforces that policy mechanically.

```js
// BAD: implicitly depends on the run-time clock
function isExpired(exp) {
  return Date.now() > exp;
}

// GOOD: inject the time
function isExpired(exp, now) {
  return now > exp;
}
```

## What it detects

- `Date.now()`
- `Date["now"]()`

A default-parameter injection point like `function f(now = Date.now())` — or a thunk, `function f(clock = () => Date.now())` — is allowed by default (`allowInDefaultParameters`, default `true`). Set it to `false` to forbid those too.

## Install

```sh
npm i -D @moznion/eslint-plugin-injected-time
```

The plugin itself has **no runtime dependencies**, so the only other things to install are the lint engine you use: `eslint` (plus `typescript-eslint` if you lint `.ts`), or `oxlint`.

## ESLint (flat config)

```js
// eslint.config.mjs
import injectedTime from "@moznion/eslint-plugin-injected-time";
import tseslint from "typescript-eslint";

export default [
  {
    files: ["**/*.js", "**/*.ts"],
    // Use the TypeScript parser so that .ts files can be parsed.
    languageOptions: { parser: tseslint.parser },
    plugins: { "injected-time": injectedTime },
    rules: { "injected-time/no-ambient-date-now": "error" },
  },
];
```

If you only lint JavaScript, drop `typescript-eslint` and the `languageOptions` entry.

CommonJS (`eslint.config.cjs`) works the same way — only the import differs:

```js
const injectedTime = require("@moznion/eslint-plugin-injected-time");
```

## oxlint

```json
// .oxlintrc.json
{
  "jsPlugins": ["@moznion/eslint-plugin-injected-time"],
  "rules": { "injected-time/no-ambient-date-now": "error" }
}
```

> oxlint's JS plugins use an ESLint-compatible API, so both engines load the same compiled rule implementation. The rule-id namespace is fixed by oxlint's `meta.name` (`injected-time`), so keep the ESLint `plugins` key in sync with it. To lint under a different namespace instead, alias the plugin: `{ "name": "injected-time-js", "specifier": "@moznion/eslint-plugin-injected-time" }`.

## Options

`allowInDefaultParameters` (default `true`) permits `Date.now()` as a default parameter value, because `function f(now = Date.now())` is itself an injection point. The same goes for a thunk that reads the time on each call, `function f(clock = () => Date.now())`. Set the option to `false` to forbid those too. Both engines accept it in the same shape:

```jsonc
"injected-time/no-ambient-date-now": ["error", { "allowInDefaultParameters": false }]
```

Only those two bare shapes are exempt. Once the default value does any work of its own, it is logic rather than an injection point and stays reported:

```js
function f(now = Date.now()) {} // GOOD
function f(clock = () => Date.now()) {} // GOOD
function f(now = Date.now() + 1) {} // BAD
function f(clock = () => Date.now() + 1) {} // BAD
function f(
  clock = () => {
    return Date.now();
  },
) {} // BAD (a statement body can hold anything)
```

## TypeScript

It works on TS too. Because the rule only inspects the `CallExpression` AST node, it detects the inner `Date.now()` even with type annotations, `as` casts, or `satisfies`.

- **oxlint**: parses TS natively, so no extra setup is needed. You can lint `.ts` as-is.
- **ESLint**: configure the `typescript-eslint` parser to parse `.ts` (see the ESLint section above).

```ts
const t: number = Date.now(); // BAD
const t = Date.now() as number; // BAD (detected even when wrapped in a cast)
function stamp(now: number = Date.now()) {} // GOOD (a typed default parameter is an injection point)
function stamp(clock: () => number = () => Date.now()) {} // GOOD (so is a typed thunk)
```

## Development

The rule is written in **strict TypeScript** (`src/`) and compiled with `tsc` to CommonJS JS in `dist/`, which is what both ESLint and oxlint load. This repository's own `eslint.config.js` / `.oxlintrc.json` point at that local `dist/` to lint `examples/`; consuming projects use the package name instead, as shown above.

Tests are **co-located** next to the source (`src/rules/*.test.ts`) and run with **vitest**, which transpiles TypeScript on the fly and imports the rule source directly — so no build step is needed to test. Each `*.test.ts` drives ESLint's `RuleTester` for both the default (espree) and typescript-eslint parsers.

```sh
pnpm run build      # src/*.ts -> dist/*.js (tests excluded from dist)
pnpm run typecheck  # type-check only (includes tests)
pnpm test           # vitest run
pnpm run test:watch # vitest (watch mode)
```

The types reference `@typescript-eslint/utils` **via `import type` only**, so the compiled `dist/rules/no-ambient-date-now.js` has **no runtime dependency** and is a self-contained plugin.

> TypeScript is kept on the `6.0.x` line (`< 6.1.0`): `typescript-eslint` (used for the parser and the rule's types) declares `peerDependencies.typescript` of `>=4.8.4 <6.1.0`, so `6.1`+ and the native `7.x` toolchain are not yet supported and would break `tsc` and any typescript-eslint-based parsing. `moduleResolution` is set to `node16` because `node10` is deprecated as of TypeScript 6.

## Implementation notes

It does not use engine-specific APIs such as `node.parent`; it relies only on the traversal-order guarantee that a parent is visited before its children. On visiting a function node it records the `Date.now()` that each default parameter offers — either directly or nested inside a `() => Date.now()` thunk — into a `WeakSet`, and checks against it when visiting a `CallExpression`, achieving identical behavior on both ESLint and oxlint.
