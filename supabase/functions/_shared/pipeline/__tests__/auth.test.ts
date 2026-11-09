import { describe, expect, it } from "vitest";
import { bearerToken, checkPipelineKey, constantTimeEqual } from "../../auth.ts";

describe("garde des fonctions du pipeline", () => {
  it("lit le jeton Bearer", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
    expect(bearerToken("bearer abc123")).toBe("abc123");
    expect(bearerToken("abc123")).toBeNull();
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("Bearer ")).toBeNull();
  });

  it("compare en temps constant, quelle que soit la longueur", async () => {
    expect(await constantTimeEqual("secret", "secret")).toBe(true);
    expect(await constantTimeEqual("secret", "secreT")).toBe(false);
    expect(await constantTimeEqual("secret", "secret-plus-long")).toBe(false);
    expect(await constantTimeEqual("", "secret")).toBe(false);
  });

  it("refuse sans clé (401), avec une mauvaise clé (401), et tout si le serveur n'a pas de secret (500)", async () => {
    expect(await checkPipelineKey(null, "k")).toEqual({ ok: false, status: 401, error: "non autorisé" });
    expect(await checkPipelineKey("Bearer faux", "k")).toEqual({ ok: false, status: 401, error: "non autorisé" });
    expect(await checkPipelineKey("Bearer k", undefined)).toMatchObject({ ok: false, status: 500 });
    expect(await checkPipelineKey("Bearer k", "")).toMatchObject({ ok: false, status: 500 });
    expect(await checkPipelineKey("Bearer k", "k")).toEqual({ ok: true });
  });
});
