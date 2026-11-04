import { describe, expect, it } from "vitest";
import { isPublished, orderApproved } from "./approved.ts";

const story = (publish_date: string | null, score = 0.5) => ({ publish_date, score });

describe("isPublished", () => {
  it("publiée dès le jour même, pas avant, jamais sans date", () => {
    expect(isPublished(story("2026-11-04"), "2026-11-04")).toBe(true);
    expect(isPublished(story("2026-11-03"), "2026-11-04")).toBe(true);
    expect(isPublished(story("2026-11-05"), "2026-11-04")).toBe(false);
    expect(isPublished(story(null), "2026-11-04")).toBe(false);
  });
});

describe("orderApproved", () => {
  it("à venir la plus proche d'abord, puis publiées récentes, puis sans date par score", () => {
    const rows = [story("2026-11-01"), story(null, 0.2), story("2026-11-10"), story("2026-11-04"), story("2026-11-06"), story(null, 0.9)];
    expect(orderApproved(rows, "2026-11-04")).toEqual([
      story("2026-11-06"), story("2026-11-10"), story("2026-11-04"), story("2026-11-01"), story(null, 0.9), story(null, 0.2),
    ]);
  });
  it("ne modifie pas le tableau d'entrée", () => {
    const rows = [story("2026-11-10"), story("2026-11-06")];
    orderApproved(rows, "2026-11-04");
    expect(rows[0]?.publish_date).toBe("2026-11-10");
  });
});
