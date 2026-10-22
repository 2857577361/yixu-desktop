import { defineConfig } from "vite";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "node:crypto": path.resolve("src/crypto.js") } },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /\.cjs$/, /ui\/(recurrence|life-model)\.js$/],
    },
  },
  server: { fs: { allow: [".."] } },
});
