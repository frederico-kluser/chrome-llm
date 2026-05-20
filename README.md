# MyLocalLLM — Extensão Chrome MV3 com LLM 100% Local

Extensão Chrome Manifest V3 que executa um Large Language Model **inteiramente no seu navegador**, sem servidor, sem telemetria, sem nuvem. Usa [WebLLM](https://github.com/mlc-ai/web-llm) + WebGPU com o engine hospedado em um Service Worker (arquitetura oficial recomendada).

## Características

- 🔒 **100% local**: nenhum dado sai do seu navegador.
- ⚡ **Aceleração WebGPU**: roda no service worker (Chrome 124+).
- 🧠 **Múltiplos modelos**: seletor com SmolLM2 360M, Qwen2 0.5B, Llama-3.2 1B (default), Llama-3.2 3B.
- 💬 **Streaming**: respostas token a token (API OpenAI-compatible).
- 💾 **Cache persistente**: o modelo é baixado uma vez e armazenado via Cache API.
- 🌗 **Dark mode** automático.

## Requisitos

| Item | Mínimo | Recomendado |
|---|---|---|
| Chrome | 124+ | 130+ |
| WebGPU | ✅ ativo (cheque `chrome://gpu`) | ✅ com `shader-f16` |
| RAM | 8 GB | 16 GB |
| Disco livre | 2 GB | 10 GB |
| GPU | iGPU moderna | RTX 3060 / Apple M1+ |

Verifique WebGPU em `chrome://gpu` — a linha "WebGPU" deve estar verde.

## Instalação (desenvolvimento)

```bash
git clone <este-repo> chrome-llm
cd chrome-llm
npm install
npm run build
```

Em seguida:
1. Abra `chrome://extensions/`
2. Ative **Modo do desenvolvedor**
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `dist/`
5. Clique no ícone "L" azul na barra de extensões
6. Selecione um modelo (default: Llama-3.2-1B) e aguarde o download na primeira vez

### Modo dev com HMR

```bash
npm run dev
```

CRXJS gera `dist/` com hot reload. Recarregue a extensão no `chrome://extensions/` após mudanças no manifest ou background.

## Estrutura

```
src/
├── manifest.ts            # Manifest MV3 tipado (CRXJS)
├── background.ts          # Service worker hospedando o engine WebLLM
├── popup/
│   ├── popup.html         # UI do chat
│   ├── popup.ts           # Cliente do engine via porta runtime
│   └── popup.css
├── lib/
│   ├── models.ts          # Catálogo de modelos exibidos
│   ├── storage.ts         # Helpers chrome.storage.local
│   └── webgpu.ts          # Detecção de WebGPU + shader-f16
└── icons/                 # PNGs 16/32/48/128
```

### Arquitetura

```
┌─────────────┐  chrome.runtime.connect  ┌──────────────────┐
│   popup.ts  │ ◄──────────────────────► │  background.ts   │
│ (UI chat)   │   "web_llm_service_      │ ExtensionService │
│             │    worker" port          │ WorkerMLCEngine  │
│             │                          │ Handler          │
└─────────────┘                          └────────┬─────────┘
                                                  │ WebGPU
                                                  ▼
                                          ┌──────────────┐
                                          │  Cache API   │
                                          │ (pesos LLM)  │
                                          └──────────────┘
```

O service worker permanece ativo durante geração (o stream de mensagens segura a porta). Modelos uma vez baixados ficam em Cache API e sobrevivem a reinicializações.

## Modelos suportados

| Modelo | Tamanho | Uso recomendado |
|---|---|---|
| SmolLM2-360M-Instruct-q4f16_1 | ~270 MB | iGPU/laptops fracos |
| Qwen2-0.5B-Instruct-q4f16_1 | ~370 MB | Testes rápidos |
| **Llama-3.2-1B-Instruct-q4f16_1** ⭐ | ~880 MB | **Default — equilíbrio** |
| Llama-3.2-3B-Instruct-q4f16_1 | ~2.3 GB | GPU dedicada |

Edite `src/lib/models.ts` para adicionar mais. IDs devem bater com `prebuiltAppConfig.model_list` de `@mlc-ai/web-llm` ([config.ts](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts)).

## Troubleshooting

### "Wasm code generation disallowed by embedder"
Falta `'wasm-unsafe-eval'` na CSP do manifest. Já incluído neste projeto — se editar `manifest.ts`, mantenha.

### "requestAdapter() returned null"
WebGPU não disponível. Verifique:
- Chrome ≥ 124
- `chrome://flags/#enable-unsafe-webgpu` (em alguns Linux)
- Driver da GPU atualizado

### "shader-f16 not supported"
Sua GPU não tem `shader-f16`. Modelos `q4f16_1` podem falhar. Solução: troque para variantes `q4f32_1` (mais lentas e maiores) em `src/lib/models.ts`.

### Download trava ou falha
- Verifique espaço em disco (≥ 5 GB livres recomendado para 3B+)
- Verifique `connect-src` no manifest cobre `huggingface.co`
- Tente um modelo menor primeiro

### O modelo "esquece" depois de fechar o popup
Normal — o histórico fica em `chrome.storage.local` e é recarregado, mas o engine recarrega quando o SW dorme. O modelo permanece em cache, então o reload é rápido (~2-5 s).

## Limitações conhecidas

- **Sem fallback Chrome < 124**: WebGPU em service worker exige 124+. Para versões anteriores, seria necessário um *offscreen document* (não implementado neste MVP).
- **Sem fallback Prompt API**: Chrome 138+ tem Gemini Nano embutido (`LanguageModel`). Adicionar como fallback é trabalho futuro.
- **Sem content script**: ler texto da página ativa não está implementado.
- **Sem side panel**: apenas popup. Side panel (`chrome.sidePanel`) é melhoria futura.

## Licenças de modelo

- **Llama 3.2**: Llama Community License (restrições para > 700 M MAU).
- **Qwen2**: Apache 2.0.
- **SmolLM2**: Apache 2.0.

Verifique antes de uso comercial.

## Licença do código

MIT — veja `LICENSE`.

## Referências

- [WebLLM](https://github.com/mlc-ai/web-llm) — `examples/chrome-extension-webgpu-service-worker`
- [Chrome MV3 CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)
- [WebGPU em Service Workers (Chrome 124)](https://developer.chrome.com/blog/new-in-webgpu-124)
- [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin)
