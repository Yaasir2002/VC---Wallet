import { redactSensitiveData } from "../../utils/redactSensitiveData";

describe("redactSensitiveData", () => {
  it("redacts sensitive fields", () => {
    const input = {
      jwt: "eyJhbGciOiJFUzI1NiJ9.payload.signature",
      credentialSubject: {
        nama: "Yaasir",
        nim: "123456",
      },
      status: "verified",
    };

    const result = redactSensitiveData(input) as any;

    expect(result.jwt).toBe("[REDACTED]");
    expect(result.credentialSubject).toBe("[REDACTED]");
    expect(result.status).toBe("verified");
  });

  it("redacts long string values", () => {
    const result = redactSensitiveData(
      "eyJhbGciOiJFUzI1NiIsImtpZCI6ImRpZDp3ZWI6ZXhhbXBsZSJ9.payload.signature",
    );

    expect(result).toContain("[REDACTED]");
  });
});
