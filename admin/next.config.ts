import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  // Le module pur d'illustration vit dans supabase/functions/_shared/pipeline (hors du dossier admin).
  outputFileTracingRoot: path.join(__dirname, ".."),
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  images: { unoptimized: true },
};

export default config;
