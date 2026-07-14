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
     * Whether to allow `Date.now()` as the default value of a function parameter.
     * Placing it at an "injection point" like `function f(now = Date.now())` is in
     * line with this policy, so it is allowed by default.
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
     * When visiting a function node, record any `Date.now()` placed as a parameter's
     * default value as allowed. Because a parent is visited before its children, this
     * set is guaranteed to be populated by the time the CallExpression is visited.
     */
    function collectAllowedDefaults(node: FunctionNode): void {
      if (!allowInDefaultParameters) {
        return;
      }
      for (const param of node.params) {
        if (param.type === "AssignmentPattern" && isDateNowCall(param.right)) {
          allowedNodes.add(param.right);
        }
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
      FunctionDeclaration: collectAllowedDefaults,
      FunctionExpression: collectAllowedDefaults,
      ArrowFunctionExpression: collectAllowedDefaults,
      CallExpression: checkCallExpression,
    };
  },
};
