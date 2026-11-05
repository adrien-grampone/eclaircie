import { describe, expect, it } from "vitest";
import { NBSP, THIN_NBSP, frenchTypography } from "./typography.ts";

const T = THIN_NBSP;
const N = NBSP;

describe("frenchTypography (cas réels de la base)", () => {
  it("groupes de chiffres", () => {
    expect(frenchTypography("Un mur de 3 500 à 4 000 ans")).toBe(`Un mur de 3${T}500 à 4${T}000 ans`);
    expect(frenchTypography("23 000 hectares revivent.")).toBe(`23${T}000 hectares revivent.`);
    expect(frenchTypography("environ 500 000 tonnes de sol et 1 000 000 d'arbres")).toBe(`environ 500${T}000 tonnes de sol et 1${T}000${T}000 d'arbres`);
    expect(frenchTypography("en 2024, 12 personnes")).toBe("en 2024, 12 personnes");
  });
  it("unités après un nombre", () => {
    expect(frenchTypography("se font à 110 °C")).toBe(`se font à 110${N}°C`);
    expect(frenchTypography("résistants aux dommages à -253 °C.")).toBe(`résistants aux dommages à -253${N}°C.`);
    expect(frenchTypography("1 000 °C, 70 % des cas, 3 km, 20%")).toBe(`1${T}000${N}°C, 70${N}% des cas, 3${N}km, 20${N}%`);
    expect(frenchTypography("plus d'un million d'euros")).toBe("plus d'un million d'euros");
    expect(frenchTypography("Sur 24 chiens soignés")).toBe("Sur 24 chiens soignés");
  });
  it("ponctuation haute et guillemets", () => {
    expect(frenchTypography("Test HPV et IA :")).toBe(`Test HPV et IA${N}:`);
    expect(frenchTypography("Les « polluants éternels »")).toBe(`Les «${T}polluants éternels${T}»`);
    expect(frenchTypography("Quelles bonnes nouvelles te font du bien ?")).toBe(`Quelles bonnes nouvelles te font du bien${T}?`);
    expect(frenchTypography("Bravo !")).toBe(`Bravo${T}!`);
    expect(frenchTypography("Rendez-vous à 10:30 sur https://x.org/a")).toBe("Rendez-vous à 10:30 sur https://x.org/a");
  });
  it("n'empile pas les espaces déjà insécables", () => {
    expect(frenchTypography(frenchTypography("Un mur de 3 500 ans : 110 °C ?"))).toBe(`Un mur de 3${T}500 ans${N}: 110${N}°C${T}?`);
  });
});
