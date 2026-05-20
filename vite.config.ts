import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest";

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: "esnext",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep chunk names predictable; CRXJS handles MV3 wrapping.
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5174 },
  },
});
