import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["supabase/functions/_shared/**/*.test.ts", "app/src/**/*.test.ts"],
    alias: { "@pipeline": new URL("./supabase/functions/_shared/pipeline", import.meta.url).pathname, "@": new URL("./app/src", import.meta.url).pathname },
  },
});
