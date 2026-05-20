export interface WebGPUStatus {
  supported: boolean;
  hasShaderF16: boolean;
  adapterInfo?: string;
  reason?: string;
}

export async function checkWebGPU(): Promise<WebGPUStatus> {
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  if (!gpu) {
    return {
      supported: false,
      hasShaderF16: false,
      reason: "navigator.gpu indisponível. Atualize o Chrome (≥124) ou ative WebGPU.",
    };
  }
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        hasShaderF16: false,
        reason: "requestAdapter() retornou null. Sua GPU pode não ter driver compatível.",
      };
    }
    const hasShaderF16 = adapter.features.has("shader-f16");
    // adapter.info é experimental; fallback amigável.
    const info = (adapter as unknown as { info?: { vendor?: string; architecture?: string } }).info;
    const adapterInfo = info ? `${info.vendor ?? ""} ${info.architecture ?? ""}`.trim() : undefined;
    return { supported: true, hasShaderF16, adapterInfo };
  } catch (err) {
    return {
      supported: false,
      hasShaderF16: false,
      reason: `Erro ao consultar adapter: ${(err as Error).message}`,
    };
  }
}
