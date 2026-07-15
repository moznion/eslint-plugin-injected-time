/**
 * @fileoverview Co-located tests for the `no-ambient-date-now` rule.
 *
 * This file lives next to the rule it tests and imports the rule source directly.
 * It is run by vitest (which transpiles TS on the fly), so no build step is needed.
 * `RuleTester.run` uses its built-in synchronous runner and throws on the first
 * failing case, so wrapping each run in a vitest `test` surfaces failures normally.
 */

import { RuleTester, type Linter, type Rule } from "eslint";
import tseslint from "typescript-eslint";
import { test } from "vitest";
import { noAmbientDateNow } from "./no-ambient-date-now";

// ESLint's `RuleTester` expects an ESLint `Rule.RuleModule`, while the rule is typed
// with `@typescript-eslint/utils`'s `RuleModule` (same shape, different node types).
// They are structurally compatible, so cast for the test harness.
const rule = noAmbientDateNow as unknown as Rule.RuleModule;

test("no-ambient-date-now (espree / JavaScript)", () => {
  const ruleTester = new RuleTester({
    languageOptions: { ecmaVersion: 2022, sourceType: "module" },
  });

  ruleTester.run("no-ambient-date-now", rule, {
    valid: [
      // The time is received as an argument (the desired shape).
      "function elapsed(now) { return now - start; }",
      // A default-parameter injection point is allowed by default.
      "function tick(now = Date.now()) { return now; }",
      "const tick = (now = Date.now()) => now;",
      // A thunk in a default parameter is an injection point too.
      "function tick(clock = () => Date.now()) { return clock(); }",
      "const tick = (clock = () => Date.now()) => clock();",
      // A default nested in a destructuring pattern is an injection point as well.
      "function tick({ now = Date.now() }) { return now; }",
      "const useX = ({ shopId, getNow = () => Date.now() }) => getNow();",
      // ...including an array pattern, a defaulted pattern, and nesting of the two.
      "function tick([now = Date.now()]) { return now; }",
      "const useX = ({ getNow = () => Date.now() } = {}) => getNow();",
      "const useX = ({ opts: { getNow = () => Date.now() } }) => getNow();",
      // A "Date.now()" string literal or an unrelated `now` is out of scope.
      "const s = 'Date.now()';",
      "foo.now();",
      "now();",
      // Computed, but not 'now'.
      "Date['getTime']();",
    ],
    invalid: [
      {
        code: "function isExpired(exp) { return Date.now() > exp; }",
        errors: [{ messageId: "ambientDateNow" }],
      },
      {
        code: "const t = Date.now();",
        errors: [{ messageId: "ambientDateNow" }],
      },
      {
        code: "const t = Date['now']();",
        errors: [{ messageId: "ambientDateNow" }],
      },
      {
        // With allowInDefaultParameters:false, even a default parameter is reported.
        code: "function tick(now = Date.now()) { return now; }",
        options: [{ allowInDefaultParameters: false }],
        errors: [{ messageId: "ambientDateNow" }],
      },
      {
        // The "body" of a default value is logic, so it is not allowed.
        code: "function tick(now = Date.now() + 1) { return now; }",
        errors: [{ messageId: "ambientDateNow" }],
      },
      {
        // Same for a thunk: only a bare `() => Date.now()` is an injection point.
        code: "function tick(clock = () => Date.now() + 1) { return clock(); }",
        errors: [{ messageId: "ambientDateNow" }],
      },
      {
        // A statement body can hold arbitrary logic, so it is not allowed.
        code: "function tick(clock = () => { return Date.now(); }) { return clock(); }",
        errors: [{ messageId: "ambientDateNow" }],
      },
      {
        // With allowInDefaultParameters:false, a thunk is reported as well.
        code: "function tick(clock = () => Date.now()) { return clock(); }",
        options: [{ allowInDefaultParameters: false }],
        errors: [{ messageId: "ambientDateNow" }],
      },
      {
        // A destructured default is still only an injection point when it is bare.
        code: "const useX = ({ getNow = () => Date.now() + 1 }) => getNow();",
        errors: [{ messageId: "ambientDateNow" }],
      },
      {
        // The destructured binding is a pattern, not a value: this is ambient logic.
        code: "const useX = ({ now = compute(Date.now()) }) => now;",
        errors: [{ messageId: "ambientDateNow" }],
      },
      {
        // allowInDefaultParameters:false covers destructured defaults too.
        code: "const useX = ({ getNow = () => Date.now() }) => getNow();",
        options: [{ allowInDefaultParameters: false }],
        errors: [{ messageId: "ambientDateNow" }],
      },
    ],
  });
});

test("no-ambient-date-now (typescript-eslint / TypeScript)", () => {
  const ruleTester = new RuleTester({
    languageOptions: {
      // typescript-eslint's parser type differs from ESLint's `Linter.Parser`,
      // but is structurally compatible; cast for the test harness.
      parser: tseslint.parser as unknown as Linter.Parser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
  });

  ruleTester.run("no-ambient-date-now", rule, {
    valid: [
      // Inject the time (with a type annotation).
      "function elapsed(now: number): number { return now - 1; }",
      // A typed default-parameter injection point is allowed by default.
      "function tick(now: number = Date.now()): number { return now; }",
      "const tick = (now: number = Date.now()): number => now;",
      // A typed thunk is an injection point too.
      "function tick(clock: () => number = () => Date.now()): number { return clock(); }",
      // A default inside a typed destructuring pattern is an injection point as well.
      "type Props = { shopId: string; getNow?: () => number };\nexport const useX = ({ shopId, getNow = () => Date.now() }: Props) => getNow();",
      // A constructor parameter property.
      "class C { constructor(private readonly now: number = Date.now()) {} }",
    ],
    invalid: [
      {
        code: "function isExpired(exp: number): boolean { return Date.now() > exp; }",
        errors: [{ messageId: "ambientDateNow" }],
      },
      {
        // Detected even when wrapped in an `as` cast.
        code: "const t = Date.now() as number;",
        errors: [{ messageId: "ambientDateNow" }],
      },
      {
        // satisfies
        code: "const t = Date.now() satisfies number;",
        errors: [{ messageId: "ambientDateNow" }],
      },
      {
        // Even a typed default parameter is reported when allowInDefaultParameters:false.
        code: "function tick(now: number = Date.now()): number { return now; }",
        options: [{ allowInDefaultParameters: false }],
        errors: [{ messageId: "ambientDateNow" }],
      },
    ],
  });
});
