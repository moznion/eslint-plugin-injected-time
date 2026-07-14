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

A default-parameter injection point like `function f(now = Date.now())` is allowed by default (`allowInDefaultParameters`, default `true`). Set it to `false` to forbid that too.

## Layout / build

The rule is written in **strict TypeScript** (`src/`) and compiled with `tsc` to CommonJS JS in `dist/`. Both ESLint and oxlint load this `dist/`.

Tests are **co-located** next to the source (`src/rules/*.test.ts`) and run with **vitest**, which transpiles TypeScript on the fly and imports the rule source directly — so no build step is needed to test. Each `*.test.ts` drives ESLint's `RuleTester` for both the default (espree) and typescript-eslint parsers.

```sh
pnpm run build      # src/*.ts -> dist/*.js (tests excluded from dist)
pnpm run typecheck  # type-check only (includes tests)
pnpm test           # vitest run
pnpm run test:watch # vitest (watch mode)
```

The types reference `@typescript-eslint/utils` **via `import type` only**, so the compiled `dist/rules/no-ambient-date-now.js` has **no runtime dependency** and is a self-contained plugin.

> TypeScript is kept on the `6.0.x` line (`< 6.1.0`): `typescript-eslint` (used for the parser and the rule's types) declares `peerDependencies.typescript` of `>=4.8.4 <6.1.0`, so `6.1`+ and the native `7.x` toolchain are not yet supported and would break `tsc` and any typescript-eslint-based parsing. `moduleResolution` is set to `node16` because `node10` is deprecated as of TypeScript 6.

## ESLint (flat config)

```js
// eslint.config.js
const injectedTime = require("eslint-plugin-injected-time"); // = dist/index.js
module.exports = [
  {
    plugins: { "injected-time": injectedTime },
    rules: { "injected-time/no-ambient-date-now": "error" },
  },
];
```

## oxlint

```json
// .oxlintrc.json
{
  "jsPlugins": ["./dist/index.js"],
  "rules": { "injected-time/no-ambient-date-now": "error" }
}
```

> oxlint's JS plugins use an ESLint-compatible API. The same compiled rule implementation (`dist/rules/no-ambient-date-now.js`) is shared by both. The rule-id namespace is fixed by oxlint's `meta.name` (`injected-time`), so the ESLint side is kept in sync with it.

## TypeScript

It works on TS too. Because the rule only inspects the `CallExpression` AST node, it detects the inner `Date.now()` even with type annotations, `as` casts, or `satisfies`.

- **oxlint**: parses TS natively, so no extra setup is needed. You can lint `.ts` as-is.
- **ESLint**: configure the `typescript-eslint` parser to parse `.ts` (see `eslint.config.js`).

```ts
const t: number = Date.now(); // BAD
const t = Date.now() as number; // BAD (detected even when wrapped in a cast)
function stamp(now: number = Date.now()) {} // GOOD (a typed default parameter is an injection point)
```

## Implementation notes

It does not use engine-specific APIs such as `node.parent`; it relies only on the traversal-order guarantee that a parent is visited before its children. On visiting a function node it records any `Date.now()` in a default parameter into a `WeakSet`, and checks against it when visiting a `CallExpression`, achieving identical behavior on both ESLint and oxlint.
