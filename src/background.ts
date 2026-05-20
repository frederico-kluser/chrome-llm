// Service Worker: hospeda o engine WebLLM via handler oficial.
// Mantém-se ativo enquanto houver geração em andamento (stream segura o port).

import { ExtensionServiceWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

let handler: ExtensionServiceWorkerMLCEngineHandler | undefined;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "web_llm_service_worker") return;

  if (handler === undefined) {
    handler = new ExtensionServiceWorkerMLCEngineHandler(port);
  } else {
    handler.setPort(port);
  }

  port.onMessage.addListener(handler.onmessage.bind(handler));
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("[MyLocalLLM] installed");
});

chrome.runtime.onStartup.addListener(() => {
  console.log("[MyLocalLLM] startup");
});
