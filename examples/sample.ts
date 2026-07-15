// BAD: detected even with a type annotation
export function isExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

// BAD: the inner Date.now() is detected even when wrapped in an `as` cast
export function nowMillis(): number {
  return Date.now() as number;
}

// BAD: with satisfies as well
const t = Date.now() satisfies number;
console.log(t);

// GOOD: inject the time from the outside
export function isExpiredPure(expiresAt: number, now: number): boolean {
  return now > expiresAt;
}

// GOOD: a typed default parameter (injection point) is allowed by default
export function stamp(now: number = Date.now()): { at: number } {
  return { at: now };
}

// GOOD: a thunk in a default parameter is an injection point too
export function stampEach(clock: () => number = () => Date.now()): { at: number } {
  return { at: clock() };
}

type Props = {
  readonly shopId: string;
  readonly getNow?: () => number;
};

// GOOD: a default nested in a destructuring pattern is an injection point as well
export const useShopTime = ({ shopId, getNow = () => Date.now() }: Props): string => {
  return `${shopId}:${getNow()}`;
};
