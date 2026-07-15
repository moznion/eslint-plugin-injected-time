// BAD: the logic implicitly depends on the run-time clock (reported)
export function isExpired(expiresAt) {
  return Date.now() > expiresAt;
}

// BAD: Date["now"]() is detected too
export function nowMillis() {
  return Date["now"]();
}

// GOOD: inject the time from the outside
export function isExpiredPure(expiresAt, now) {
  return now > expiresAt;
}

// GOOD: a default parameter (injection point) is allowed by default
export function stamp(now = Date.now()) {
  return { at: now };
}

// GOOD: a thunk in a default parameter is an injection point too
export function stampEach(clock = () => Date.now()) {
  return { at: clock() };
}
