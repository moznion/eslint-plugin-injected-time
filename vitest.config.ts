import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Co-located tests live next to the sources they exercise.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
