import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: {
    fs: {
      allow: [path.resolve(currentDir, "..", "..")],
    },
  },
});
