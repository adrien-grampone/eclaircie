import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["supabase/functions/_shared/**/*.test.ts"],
  },
});
