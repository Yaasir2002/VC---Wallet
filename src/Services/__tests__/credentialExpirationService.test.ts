import { validateCredentialExpiration } from "../credentialExpirationService";

describe("validateCredentialExpiration", () => {
  it("returns expired for past expiration date", () => {
    const result = validateCredentialExpiration({
      expirationDate: "2020-01-01T00:00:00.000Z",
    });

    expect(result.isExpired).toBe(true);
    expect(result.status).toBe("expired");
  });

  it("returns not_yet_valid for future validFrom", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const result = validateCredentialExpiration({
      validFrom: future,
    });

    expect(result.isNotYetValid).toBe(true);
    expect(result.status).toBe("not_yet_valid");
  });

  it("returns no_expiration when expiration is missing", () => {
    const result = validateCredentialExpiration({
      issuanceDate: "2024-01-01T00:00:00.000Z",
    });

    expect(result.isExpired).toBe(false);
    expect(result.status).toBe("no_expiration");
  });
});
