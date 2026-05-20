import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";

const HISTORY_KEY = "chat_history";
const MODEL_KEY = "selected_model";

export async function loadHistory(): Promise<ChatCompletionMessageParam[]> {
  const res = await chrome.storage.local.get(HISTORY_KEY);
  return (res[HISTORY_KEY] as ChatCompletionMessageParam[] | undefined) ?? [];
}

export async function saveHistory(history: ChatCompletionMessageParam[]): Promise<void> {
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.remove(HISTORY_KEY);
}

export async function loadSelectedModel(): Promise<string | undefined> {
  const res = await chrome.storage.local.get(MODEL_KEY);
  return res[MODEL_KEY] as string | undefined;
}

export async function saveSelectedModel(id: string): Promise<void> {
  await chrome.storage.local.set({ [MODEL_KEY]: id });
}
