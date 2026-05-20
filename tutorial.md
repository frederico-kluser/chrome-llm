# Tutorial — MyLocalLLM (chrome-llm)

Documento-guia de quem chegou agora ao projeto: **o que foi feito até v0.1.1, como rodar, como evoluir** e o que ainda **falta implementar** para sair de MVP rumo a uma extensão de produção.

> Repo: https://github.com/frederico-kluser/chrome-llm
> Última versão publicada: **v0.1.1**
> Stack: Chrome MV3 + WebLLM + WebGPU + Vite + CRXJS + TypeScript + Husky

---

## 1. O que foi feito ✅

### 1.1. Bootstrap e infraestrutura
- **Repo Git inicializado** em `main` e publicado como repo **público** no GitHub.
- **Licença MIT**, `description`, `homepage` e 10 *topics* (`chrome-extension`, `manifest-v3`, `webllm`, `webgpu`, `llm`, `local-llm`, `on-device-ai`, `llama`, `privacy`, `typescript`) configurados no "About".
- **Releases** habilitadas. Release inicial **v0.1.0** com `chrome-llm-v0.1.0.zip` (build pronto para *Load unpacked*).
- **Husky 9 + hook `pre-push`** que, ao pushar em `main`:
  1. roda `npm version patch` → cria commit `chore(release): vX.Y.Z [skip ci]` + tag;
  2. faz `git push --follow-tags` automaticamente (com guard anti-loop `SKIP_VERSION_BUMP=1` e detecção pelo subject do último commit);
  3. aborta o push original (já enviou o conteúdo novo).
  - Bypass disponível: `HUSKY=0 git push`.
  - Já validado end-to-end: `v0.1.0 → v0.1.1` foi gerado automaticamente.

### 1.2. Build & tipagem
- **Vite 5 + `@crxjs/vite-plugin`** com manifest tipado em `src/manifest.ts`.
- **TypeScript estrito** (`strict: true`, `noImplicitAny: true`).
- Tipos do WebGPU via `@webgpu/types`.
- Build verificado: `npm run build` gera `dist/` válido (~6 MB minified, 2.1 MB gzipped, ~2.1 MB zipado para distribuição).

### 1.3. Manifest MV3
Arquivo: `src/manifest.ts`. Pontos críticos:
- `manifest_version: 3`, `minimum_chrome_version: "124"` (exigido para WebGPU em service worker).
- `background.type: "module"` (ESM service worker).
- CSP com **`'wasm-unsafe-eval'`** (obrigatório para compilar/instanciar WASM em runtime).
- `connect-src` cobre `huggingface.co` e subdomínios de CDN do MLC/HF para download dos pesos.
- `permissions`: `storage`, `unlimitedStorage` (para os pesos de GB armazenados em Cache API).
- `action.default_popup` apontando para o popup.

### 1.4. Service worker (engine WebLLM)
Arquivo: `src/background.ts`.

Hospeda o engine via **`ExtensionServiceWorkerMLCEngineHandler`** (padrão oficial WebLLM, exemplo `chrome-extension-webgpu-service-worker`). Conecta com o popup via `chrome.runtime.connect({ name: "web_llm_service_worker" })`. O streaming de mensagens mantém o SW vivo durante a geração.

### 1.5. Popup de chat
Arquivos: `src/popup/popup.{html,ts,css}`.

- **Streaming token-a-token** via `engine.chat.completions.create({ stream: true })` (API OpenAI-compatible).
- **Seletor de modelo** (default Llama-3.2-1B):
  - SmolLM2-360M (~270 MB) — iGPUs / dispositivos fracos
  - Qwen2-0.5B (~370 MB) — testes rápidos
  - **Llama-3.2-1B (~880 MB) ⭐** — default, equilíbrio
  - Llama-3.2-3B (~2.3 GB) — qualidade, exige GPU dedicada
- **Barra de progresso** durante o download/compilação do modelo.
- **Botões**: Enviar, Parar (interrompe geração), Limpar (zera histórico), Recarregar modelo.
- **Atalhos**: `Enter` envia, `Shift+Enter` quebra linha.
- **Dark mode** automático via `prefers-color-scheme`.

### 1.6. Persistência & utilidades
- `src/lib/storage.ts` — helpers para `chrome.storage.local` (histórico e modelo escolhido).
- `src/lib/webgpu.ts` — detecta `navigator.gpu`, `requestAdapter()` e a feature `shader-f16`.
- `src/lib/models.ts` — catálogo de modelos exibidos (fácil de editar).
- Histórico de chat persiste entre aberturas do popup.

### 1.7. Documentação
- `README.md` — visão geral, requisitos, instalação dev, modelos, troubleshooting, limitações conhecidas, licenças, arquitetura ASCII.
- `LICENSE` — MIT.
- `tutorial.md` — este arquivo.

---

## 2. Como rodar localmente

```bash
git clone https://github.com/frederico-kluser/chrome-llm.git
cd chrome-llm
npm install
npm run build
```

1. Abra `chrome://extensions/`.
2. Ative **Modo do desenvolvedor**.
3. Clique **Carregar sem compactação** → selecione `dist/`.
4. Clique no ícone "L" azul na barra; espere o primeiro download (~880 MB para o default).

Para desenvolvimento contínuo com HMR:
```bash
npm run dev
```
Recarregue a extensão em `chrome://extensions/` após mudar `manifest.ts` ou `background.ts`.

---

## 3. Fluxo de release (já automatizado)

Faça suas mudanças normalmente. Quando der `git push origin main`:

1. O hook **`.husky/pre-push`** detecta push para `main`.
2. Roda `npm version patch` → commit `chore(release): vX.Y.Z [skip ci]` + tag `vX.Y.Z`.
3. Faz `git push --follow-tags` para o GitHub.
4. Aborta o push original (já enviou; o erro `husky - pre-push script failed (code 1)` é **por design**).

### Pular o auto-bump
Para fixes urgentes, docs, ou rebases:
```bash
HUSKY=0 git push origin main
# ou
SKIP_VERSION_BUMP=1 git push origin main
```

### Subir um release no GitHub
Hoje é manual:
```bash
npm run build
cd dist && zip -qr ../chrome-llm-v$(node -p "require('../package.json').version").zip . && cd ..
gh release create v$(node -p "require('./package.json').version") chrome-llm-v$(node -p "require('./package.json').version").zip \
  --title "v$(node -p "require('./package.json').version")" \
  --generate-notes
```

---

## 4. Arquitetura atual (resumo)

```
┌─────────────┐  chrome.runtime.connect  ┌──────────────────────┐
│  popup.ts   │ ◄──────────────────────► │   background.ts      │
│ (UI chat)   │  port "web_llm_service_  │ ExtensionService     │
│             │   worker"                │ WorkerMLCEngine      │
└─────────────┘                          │ Handler              │
                                         └──────────┬───────────┘
                                                    │ WebGPU (Chrome 124+)
                                                    ▼
                                            ┌──────────────┐
                                            │  Cache API   │
                                            │ (pesos LLM)  │
                                            └──────────────┘
```

Decisão arquitetural: **engine vive no service worker** (arquitetura A do brief técnico). Vantagens vs. popup-engine: o modelo não é descarregado ao fechar o popup; o SW permanece ativo enquanto há streaming.

---

## 5. O que falta fazer 🚧

### 5.1. Curto prazo (UX & robustez)

- [ ] **CHANGELOG.md automático** — adicionar `release-it` ou `conventional-changelog-cli` no hook para gerar/atualizar `CHANGELOG.md` com cada patch.
- [ ] **Markdown rendering** nas respostas — hoje o assistente exibe como `<pre>` texto cru. Usar `marked` + sanitização (`DOMPurify`) para listas, código, negrito.
- [ ] **Syntax highlighting** em blocos de código (e.g., `highlight.js` ou `shiki` — atenção ao bundle).
- [ ] **Indicador de tokens/segundo** ao vivo (já temos `engine.runtimeStatsText()`).
- [ ] **Botão "copiar"** em cada mensagem do assistente.
- [ ] **Mostrar tamanho efetivo do cache** (via `navigator.storage.estimate()`) + botão "limpar modelos baixados".
- [ ] **Mensagens de erro mais amigáveis** para erros específicos (sem `shader-f16`, sem disco, GPU rejeitada).
- [ ] **Ícone real** (atualmente é um "L" gerado em ImageMagick — placeholder).

### 5.2. Médio prazo (features)

- [ ] **Side Panel** (`chrome.sidePanel`) — alternativa ao popup, persiste enquanto a aba/janela viver. Melhor UX para chats longos.
- [ ] **Content script** — capturar texto selecionado da página e enviar pro chat (ex.: "resuma esta seleção", "traduza", "explique").
- [ ] **Context menu** — clique direito → "Pergunte ao MyLocalLLM sobre isso".
- [ ] **Múltiplos chats** (sessões nomeadas) com sidebar.
- [ ] **Export/import de histórico** (JSON).
- [ ] **System prompt customizável** pelo usuário (campo nas configurações).
- [ ] **Parâmetros de geração** ajustáveis na UI (`temperature`, `top_p`, `max_tokens`).
- [ ] **Stop sequences** customizáveis.

### 5.3. Compatibilidade

- [ ] **Fallback para offscreen document** (Chrome < 124 ou quando o SW não consegue WebGPU). Padrão: `chrome.offscreen.createDocument({ reasons: ["WORKERS"] })` carrega o engine fora do SW.
- [ ] **Fallback para Chrome Built-in AI (Prompt API / Gemini Nano)** em Chrome 138+. Detectar com `LanguageModel.availability()` e usar como caminho primário (corta 880 MB de download para muitos usuários).
- [ ] **Detecção de `shader-f16`** + troca automática para variantes `q4f32_1` quando ausente.
- [ ] **Fallback WASM-only** (via `wllama` ou WebLLM CPU) para usuários sem WebGPU. Aviso claro do trade-off de performance.
- [ ] **Suporte Firefox/Edge** — testar; provavelmente requer ajustes na CSP e `browser_specific_settings`.

### 5.4. Qualidade & DX

- [ ] **Testes unitários** — `vitest` para `lib/` (storage, webgpu, models).
- [ ] **Testes E2E** — `playwright` carregando a extensão em Chrome headed e checando o popup.
- [ ] **ESLint + Prettier** — não configurados ainda.
- [ ] **GitHub Actions CI**:
  - [ ] Workflow `ci.yml`: typecheck + build + lint em PRs e push.
  - [ ] Workflow `release.yml`: ao push de tag `v*.*.*`, gera o `.zip` e cria o release com asset (automatiza o passo manual atual).
- [ ] **Dependabot** ou Renovate para atualizar `@mlc-ai/web-llm` automaticamente.
- [ ] **Commitlint + Husky `commit-msg`** para impor Conventional Commits.
- [ ] **Substituir `npm version patch` por `release-it`** com geração de changelog + release notes automáticas.

### 5.5. Publicação

- [ ] **Empacotar para Chrome Web Store** — gerar `.zip` final, criar conta de developer ($5), preencher listing (screenshots, ícone 128×128 real, descrição detalhada, política de privacidade).
- [ ] **Política de privacidade** — texto declarando explicitamente "nenhum dado sai do navegador". Hospedar em GitHub Pages.
- [ ] **Screenshots e GIF demonstrativo** no README e na Web Store.
- [ ] **Web Store badge** no README.
- [ ] **Suporte a auto-update** — já default na Chrome Web Store; verificar que o `update_url` não conflita.

### 5.6. Performance & UX avançada

- [ ] **Pre-warm** do engine ao instalar/iniciar (`chrome.runtime.onStartup` → carrega modelo em background, com aviso ao usuário).
- [ ] **Lazy import** dos modelos grandes — só baixa o que o usuário selecionou.
- [ ] **Streaming Markdown progressivo** (renderizar conforme chega, sem reprocessar tudo a cada delta).
- [ ] **Code splitting** do bundle WebLLM (atualmente 6 MB num único chunk) — usar `manualChunks` no Rollup.
- [ ] **Telemetria local opt-in** — tokens gerados, latência, sem enviar nada para fora.

### 5.7. Ideias futuras

- [ ] **RAG local** — embedding de páginas visitadas (com Transformers.js) + busca semântica em conversas anteriores.
- [ ] **Tool use / function calling** — modo agente que pode chamar `chrome.tabs.query`, `fetch` allowlisted, etc.
- [ ] **Voz** — Web Speech API para input + TTS local para output.
- [ ] **Multi-modelo simultâneo** — comparar respostas de Llama vs Qwen lado-a-lado.
- [ ] **Modo "developer"** com console de tokens/probabilidades.

---

## 6. Estrutura atual de arquivos

```
chrome-llm/
├── .husky/
│   ├── _/                       # husky internals
│   └── pre-push                 # auto-bump patch version on push main
├── src/
│   ├── manifest.ts              # MV3 manifest tipado (CRXJS)
│   ├── background.ts            # Service Worker + WebLLM handler
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts             # UI + cliente do engine
│   │   └── popup.css
│   ├── lib/
│   │   ├── models.ts            # catálogo
│   │   ├── storage.ts           # chrome.storage.local
│   │   └── webgpu.ts            # detecção GPU
│   └── icons/                   # PNGs placeholder (16/32/48/128)
├── dist/                        # gerado por `npm run build` (gitignored)
├── node_modules/                # gitignored
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── README.md                    # docs principais
├── tutorial.md                  # este arquivo
├── LICENSE                      # MIT
└── .gitignore
```

---

## 7. Decisões técnicas registradas

1. **WebLLM em vez de Transformers.js v3** — única lib com exemplos oficiais MV3 e suporte de primeira classe a WebGPU no service worker.
2. **Engine no service worker (não no popup nem offscreen)** — persistência maior, código mais limpo. SW dorme quando ocioso mas o modelo permanece em Cache API.
3. **Default Llama-3.2-1B** — sweet spot entre tamanho (~880 MB) e qualidade.
4. **Vite + CRXJS em vez de Parcel/WXT** — mais moderno, HMR melhor, ecossistema TS forte.
5. **Husky pre-push em vez de GitHub Actions** — bump local mais rápido; futuro CI pode complementar com release automatizado.
6. **Cache API (default WebLLM) em vez de IndexedDB ou OPFS** — funciona out-of-the-box; mudar só se ver inconsistências.

---

## 8. Como contribuir

1. Fork → branch `feature/<nome>` (ou `fix/<nome>`).
2. Commits em **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
3. PR contra `main` com descrição clara, screenshots se UI.
4. Não rebase/force-push depois de aberto.
5. Não inclua `dist/` ou `node_modules/` no commit.

---

## 9. Roadmap sugerido (ordem de prioridade)

1. **v0.2.0** — Markdown rendering + botão copiar + ícone real → primeira release "apresentável".
2. **v0.3.0** — Side panel + content script (selecionar texto na página).
3. **v0.4.0** — Fallback Prompt API (Chrome 138+) + fallback offscreen (Chrome < 124).
4. **v0.5.0** — GitHub Actions com release automático em push de tag; CHANGELOG automático.
5. **v0.6.0** — System prompt customizável + sliders de geração.
6. **v0.7.0** — Tests (vitest + playwright) + ESLint.
7. **v1.0.0** — Publicação na Chrome Web Store.

---

_Atualizado em 2026-05-20. PRs e issues bem-vindos: https://github.com/frederico-kluser/chrome-llm/issues_
