import {
  CreateExtensionServiceWorkerMLCEngine,
  type ChatCompletionMessageParam,
  type InitProgressReport,
  type MLCEngineInterface,
} from "@mlc-ai/web-llm";

import { MODELS, DEFAULT_MODEL_ID } from "../lib/models";
import {
  loadHistory,
  saveHistory,
  clearHistory,
  loadSelectedModel,
  saveSelectedModel,
} from "../lib/storage";
import { checkWebGPU } from "../lib/webgpu";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const progressEl = $<HTMLDivElement>("#progress");
const chatEl = $<HTMLDivElement>("#chat");
const promptEl = $<HTMLTextAreaElement>("#prompt");
const sendBtn = $<HTMLButtonElement>("#send-btn");
const stopBtn = $<HTMLButtonElement>("#stop-btn");
const clearBtn = $<HTMLButtonElement>("#clear-btn");
const reloadBtn = $<HTMLButtonElement>("#reload-btn");
const selectEl = $<HTMLSelectElement>("#model-select");
const gpuWarn = $<HTMLDivElement>("#gpu-warning");
const formEl = $<HTMLFormElement>("#chat-form");

let engine: MLCEngineInterface | null = null;
let currentModel = DEFAULT_MODEL_ID;
let history: ChatCompletionMessageParam[] = [];
let generating = false;

const SYSTEM_PROMPT: ChatCompletionMessageParam = {
  role: "system",
  content: "Você é um assistente útil, responda em português de forma concisa.",
};

function setProgress(text: string): void {
  progressEl.textContent = text;
}

function appendMessage(role: "user" | "assistant" | "system", content: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = content;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

function renderHistory(): void {
  chatEl.innerHTML = "";
  for (const m of history) {
    if (m.role === "system") continue;
    if (typeof m.content === "string") {
      appendMessage(m.role as "user" | "assistant", m.content);
    }
  }
}

function populateModelSelect(selectedId: string): void {
  selectEl.innerHTML = "";
  for (const m of MODELS) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.label;
    if (m.id === selectedId) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

function setBusy(busy: boolean): void {
  generating = busy;
  sendBtn.disabled = busy;
  stopBtn.disabled = !busy;
  selectEl.disabled = busy;
  reloadBtn.disabled = busy;
  clearBtn.disabled = busy;
}

async function initEngine(modelId: string): Promise<void> {
  setBusy(true);
  setProgress(`Inicializando ${modelId}…`);
  try {
    engine = await CreateExtensionServiceWorkerMLCEngine(modelId, {
      initProgressCallback: (p: InitProgressReport) => {
        const pct = (p.progress * 100).toFixed(1);
        setProgress(`${pct}% — ${p.text}`);
      },
    });
    setProgress(`Pronto: ${modelId}`);
    currentModel = modelId;
    await saveSelectedModel(modelId);
  } catch (err) {
    const msg = (err as Error).message;
    setProgress(`Erro ao carregar modelo: ${msg}`);
    appendMessage(
      "system",
      `Falha ao inicializar ${modelId}: ${msg}\n\nDicas:\n- Verifique WebGPU (chrome://gpu)\n- Verifique espaço em disco\n- Tente um modelo menor`,
    );
    engine = null;
  } finally {
    setBusy(false);
  }
}

async function sendPrompt(): Promise<void> {
  if (!engine) {
    appendMessage("system", "Engine não inicializado. Recarregue o modelo.");
    return;
  }
  const text = promptEl.value.trim();
  if (!text) return;
  promptEl.value = "";

  history.push({ role: "user", content: text });
  appendMessage("user", text);
  const assistantDiv = appendMessage("assistant", "");

  setBusy(true);
  let full = "";
  try {
    const messages: ChatCompletionMessageParam[] = [SYSTEM_PROMPT, ...history];
    const stream = await engine.chat.completions.create({
      stream: true,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        full += delta;
        assistantDiv.textContent = full;
        chatEl.scrollTop = chatEl.scrollHeight;
      }
    }
    history.push({ role: "assistant", content: full });
    await saveHistory(history);
    // Estatísticas do último runtime (se disponíveis)
    try {
      const stats = await engine.runtimeStatsText();
      setProgress(stats);
    } catch {
      /* opcional */
    }
  } catch (err) {
    const msg = (err as Error).message;
    if (full) {
      history.push({ role: "assistant", content: full });
      await saveHistory(history);
    }
    appendMessage("system", `Erro durante geração: ${msg}`);
  } finally {
    setBusy(false);
  }
}

function bindEvents(): void {
  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!generating) void sendPrompt();
  });

  promptEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!generating) void sendPrompt();
    }
  });

  stopBtn.addEventListener("click", async () => {
    if (engine) {
      try {
        await engine.interruptGenerate();
      } catch {
        /* noop */
      }
    }
  });

  clearBtn.addEventListener("click", async () => {
    history = [];
    await clearHistory();
    renderHistory();
    appendMessage("system", "Histórico limpo.");
  });

  reloadBtn.addEventListener("click", async () => {
    const target = selectEl.value;
    await initEngine(target);
  });

  selectEl.addEventListener("change", async () => {
    const target = selectEl.value;
    if (target !== currentModel) {
      await initEngine(target);
    }
  });
}

async function main(): Promise<void> {
  const gpu = await checkWebGPU();
  if (!gpu.supported) {
    gpuWarn.classList.remove("hidden");
    gpuWarn.textContent = `⚠ WebGPU não disponível: ${gpu.reason ?? "desconhecido"}. A extensão precisa de Chrome 124+ com WebGPU.`;
  } else if (!gpu.hasShaderF16) {
    gpuWarn.classList.remove("hidden");
    gpuWarn.textContent =
      "⚠ Sua GPU não suporta shader-f16. Modelos q4f16_1 podem falhar — escolha variantes q4f32_1 se necessário.";
  }

  const savedModel = (await loadSelectedModel()) ?? DEFAULT_MODEL_ID;
  populateModelSelect(savedModel);

  history = await loadHistory();
  renderHistory();

  bindEvents();
  await initEngine(savedModel);
}

void main();
