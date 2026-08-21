import { defineConfig } from "vitest/config";
import path from "path";

// Load .env.local so tests can read Supabase credentials.
// process.loadEnvFile is available in Node 21.7+ (we're on 26.7).
process.loadEnvFile(".env.local");

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Integration tests share a Supabase project — sequential execution
    // prevents cross-file data interference from parallel test files.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});