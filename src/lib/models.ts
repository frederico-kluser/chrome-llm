export interface ModelOption {
  id: string;
  label: string;
  approxSizeMb: number;
  notes: string;
}

// IDs precisam bater com prebuiltAppConfig.model_list do @mlc-ai/web-llm.
// Confirme em https://github.com/mlc-ai/web-llm/blob/main/src/config.ts em caso de erro.
export const MODELS: ModelOption[] = [
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    label: "SmolLM2 360M (mais leve, ~270 MB)",
    approxSizeMb: 270,
    notes: "Recomendado para iGPU/laptops fracos.",
  },
  {
    id: "Qwen2-0.5B-Instruct-q4f16_1-MLC",
    label: "Qwen2 0.5B (rápido, ~370 MB)",
    approxSizeMb: 370,
    notes: "Default oficial dos exemplos WebLLM.",
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 1B (equilíbrio, ~880 MB) ⭐",
    approxSizeMb: 880,
    notes: "Default desta extensão.",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B (melhor qualidade, ~2.3 GB)",
    approxSizeMb: 2300,
    notes: "Requer GPU dedicada para boa performance.",
  },
];

export const DEFAULT_MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
