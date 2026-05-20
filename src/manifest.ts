import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "MyLocalLLM",
  version: "0.1.0",
  description: "Chat 100% local no navegador (WebLLM + WebGPU). Sem servidor.",
  minimum_chrome_version: "124",
  icons: {
    "16": "src/icons/icon-16.png",
    "32": "src/icons/icon-32.png",
    "48": "src/icons/icon-48.png",
    "128": "src/icons/icon-128.png",
  },
  action: {
    default_title: "MyLocalLLM",
    default_popup: "src/popup/popup.html",
  },
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  permissions: ["storage", "unlimitedStorage"],
  content_security_policy: {
    extension_pages:
      "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; default-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' data: blob: https://huggingface.co https://*.huggingface.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co https://cdn-lfs-us-1.hf.co https://raw.githubusercontent.com",
  },
});
