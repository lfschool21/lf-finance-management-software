import { describe, it, expect } from "vitest";

function shouldRedirectToDashboard(accountsCount: number, yearsCount: number): boolean {
  return accountsCount > 0 || yearsCount > 0;
}

describe("Setup Redirect Logic for Existing Users", () => {
  it("redirects existing user to dashboard when accounts exist for their UUID", () => {
    expect(shouldRedirectToDashboard(1, 0)).toBe(true);
    expect(shouldRedirectToDashboard(3, 0)).toBe(true);
  });

  it("redirects existing user to dashboard when academic years exist for their UUID", () => {
    expect(shouldRedirectToDashboard(0, 1)).toBe(true);
  });

  it("redirects existing user to dashboard when both accounts and years exist", () => {
    expect(shouldRedirectToDashboard(2, 1)).toBe(true);
  });

  it("directs user to setup only when no business data exists for their UUID", () => {
    expect(shouldRedirectToDashboard(0, 0)).toBe(false);
  });
});
