import { pickFallbackImage } from "../../../../supabase/functions/_shared/pipeline/illustration.ts";
import { publicImageUrl, storyImageUrl } from "../illustration.ts";

const URL = "https://x.supabase.co/";

describe("storyImageUrl", () => {
  it("prend l'illustration de la story quand elle existe", () => {
    expect(storyImageUrl(URL, { id: "s1", theme_id: "planete", image_path: "s1.webp" }, ["fallback/planete/a.webp"]))
      .toEqual({ url: "https://x.supabase.co/storage/v1/object/public/illustrations/s1.webp", fallback: false });
  });

  it("sinon la même image de secours que le back-office choisirait, déterministe", () => {
    const files = ["fallback/planete/a.webp", "fallback/planete/b.webp", "fallback/planete/c.webp"];
    const expected = pickFallbackImage("planete", files, "s2");
    const got = storyImageUrl(URL, { id: "s2", theme_id: "planete", image_path: null }, files);
    expect(got).toEqual({ url: publicImageUrl(URL, expected as string), fallback: true });
    expect(storyImageUrl(URL, { id: "s2", theme_id: "planete", image_path: null }, files)).toEqual(got);
  });

  it("renvoie null sans illustration ni image de secours du thème", () => {
    expect(storyImageUrl(URL, { id: "s3", theme_id: "planete", image_path: null }, ["fallback/science/a.webp"])).toBeNull();
  });
});
