/**
 * @fileoverview Rule that forbids reading the current time ambiently via `Date.now()`.
 *
 * When logic depends on "the instant it happens to run", it:
 *   - becomes tightly coupled to the ambient state and behaves nondeterministically, and
 *   - cannot fix the clock in tests, hurting testability.
 * This rule enforces the policy that time must be injected from the outside as an argument.
 *
 * Works with both ESLint and oxlint. It does not use engine-specific APIs such as
 * `node.parent`; it relies only on the traversal order guarantee that a parent node
 * is visited before its children.
 *
 * The types come from `@typescript-eslint/utils` via `import type` only, so the
 * compiled JS has no runtime dependency and is a self-contained plugin.
 */

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

/** Options accepted by this rule. */
export type Options = [
  {
    /**
     * Whether to allow `Date.now()` as the default value of a function parameter,
     * including one nested in a destructuring pattern. Placing it at an "injection
     * point" like `function f(now = Date.now())`, `function f(clock = () => Date.now())`
     * or `function f({ clock = () => Date.now() })` is in line with this policy, so it is
     * allowed by default.
     */
    readonly allowInDefaultParameters?: boolean;
  }?,
];

/** Message IDs used when reporting. */
export type MessageIds = "ambientDateNow";

/** Union of function-like nodes. */
type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

/**
 * Type guard that determines whether the given node is a `Date.now()` call.
 * Covers both `Date.now()` and `Date["now"]()`.
 */
function isDateNowCall(node: TSESTree.Node | null | undefined): node is TSESTree.CallExpression {
  if (node === null || node === undefined || node.type !== "CallExpression") {
    return false;
  }

  const callee = node.callee;
  if (callee.type !== "MemberExpression") {
    return false;
  }

  // Does it reference `Date`?
  const object = callee.object;
  if (object.type !== "Identifier" || object.name !== "Date") {
    return false;
  }

  // Does it reference `.now`? (both `Date.now` and `Date["now"]`)
  const property = callee.property;
  if (!callee.computed && property.type === "Identifier") {
    return property.name === "now";
  }
  if (callee.computed && property.type === "Literal") {
    return property.value === "now";
  }

  return false;
}

/**
 * Extracts the `Date.now()` call that a default value offers as an injection point,
 * or `null` if the value is not one.
 *
 * Two shapes qualify:
 *   - `f(now = Date.now())`       the time itself
 *   - `f(now = () => Date.now())` a thunk that reads the time on each call
 *
 * A concise-body arrow is required for the latter: a statement body (or anything
 * else, such as `Date.now() + 1`) is logic rather than a bare injection point.
 */
function findInjectedDateNow(
  node: TSESTree.Node | null | undefined,
): TSESTree.CallExpression | null {
  if (isDateNowCall(node)) {
    return node;
  }

  if (
    node?.type === "ArrowFunctionExpression" &&
    node.body.type !== "BlockStatement" &&
    isDateNowCall(node.body)
  ) {
    return node.body;
  }

  return null;
}

export const noAmbientDateNow: TSESLint.RuleModule<MessageIds, Options> = {
  defaultOptions: [{ allowInDefaultParameters: true }],
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow reading the current time ambiently via `Date.now()` (inject the time from the outside as an argument)",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowInDefaultParameters: {
            type: "boolean",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      ambientDateNow:
        "Do not read the current time ambiently via `Date.now()`. An implicit dependency on the current time hurts testability; pass the time in as an argument instead.",
    },
  },

  create(context) {
    const option = context.options[0];
    // Defaults to true.
    const allowInDefaultParameters = option?.allowInDefaultParameters !== false;

    // Remember the CallExpression nodes that are allowed (default values of default
    // parameters). Node identity is stable within a single traversal, so a WeakSet
    // can compare them by reference.
    const allowedNodes = new WeakSet<TSESTree.CallExpression>();

    /**
     * Walks a parameter's binding pattern and records every `Date.now()` offered by a
     * default value as allowed.
     *
     * Recursion is what lets a default nested inside a destructuring pattern count as an
     * injection point, which is the idiomatic shape for an options object:
     *
     *   f({ shopId, getNow = () => Date.now() })   an object pattern property
     *   f([now = Date.now()])                      an array pattern element
     *   f({ getNow = () => Date.now() } = {})      a pattern that is itself defaulted
     *
     * Only the binding pattern is walked, never a default *value* other than through
     * `findInjectedDateNow`, so `f({ a = compute(Date.now()) })` stays reported.
     */
    function collectAllowedDefaults(pattern: TSESTree.Node | null | undefined): void {
      switch (pattern?.type) {
        case "AssignmentPattern": {
          const injected = findInjectedDateNow(pattern.right);
          if (injected !== null) {
            allowedNodes.add(injected);
          }
          // `{ getNow = () => Date.now() } = {}` nests the pattern on the left.
          collectAllowedDefaults(pattern.left);
          break;
        }
        case "ObjectPattern":
          for (const property of pattern.properties) {
            collectAllowedDefaults(
              property.type === "RestElement" ? property.argument : property.value,
            );
          }
          break;
        case "ArrayPattern":
          for (const element of pattern.elements) {
            // A hole (`[, a = Date.now()]`) yields a null element.
            collectAllowedDefaults(element);
          }
          break;
        case "RestElement":
          collectAllowedDefaults(pattern.argument);
          break;
        case "TSParameterProperty":
          // `constructor(private readonly now = Date.now())`
          collectAllowedDefaults(pattern.parameter);
          break;
        default:
          break;
      }
    }

    /**
     * When visiting a function node, record the `Date.now()` calls its parameters offer
     * as injection points. Because a parent is visited before its children, this set is
     * guaranteed to be populated by the time the CallExpression is visited — including
     * the one nested inside a `() => Date.now()` thunk.
     */
    function collectAllowedParams(node: FunctionNode): void {
      if (!allowInDefaultParameters) {
        return;
      }
      for (const param of node.params) {
        collectAllowedDefaults(param);
      }
    }

    function checkCallExpression(node: TSESTree.CallExpression): void {
      if (!isDateNowCall(node) || allowedNodes.has(node)) {
        return;
      }
      context.report({ node, messageId: "ambientDateNow" });
    }

    return {
      // esquery selectors (e.g. `:function`) may be unsupported by oxlint, so register
      // the three kinds of function nodes explicitly.
      FunctionDeclaration: collectAllowedParams,
      FunctionExpression: collectAllowedParams,
      ArrowFunctionExpression: collectAllowedParams,
      CallExpression: checkCallExpression,
    };
  },
};
