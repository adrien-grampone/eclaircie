import { describe, expect, it } from "vitest";
import { demoValue } from "./demo.ts";

describe("demoValue", () => {
  it("honore la variable en développement", () => {
    expect(demoValue("auto", true)).toBe("auto");
  });
  it("ignore la variable hors développement, même définie", () => {
    expect(demoValue("auto", false)).toBeUndefined();
    expect(demoValue("show", false)).toBeUndefined();
  });
  it("ne renvoie rien pour une variable absente ou vide", () => {
    expect(demoValue(undefined, true)).toBeUndefined();
    expect(demoValue("", true)).toBeUndefined();
  });
});
