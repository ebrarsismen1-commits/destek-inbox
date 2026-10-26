import type { Analysis, Message } from "../types";
import { classifyWithLlm } from "./llm";
import { classifyWithRules } from "./rules";

export { getModel } from "./llm";

export function getAnalysisMode(): "llm" | "rules" {
  return process.env.ANTHROPIC_API_KEY ? "llm" : "rules";
}

/** Mesajı analiz eder. Asla fırlatmaz: anahtar yoksa ya da LLM hata verirse kural tabanlı sonuca düşer. */
export async function analyzeMessage(message: Message): Promise<Analysis> {
  if (getAnalysisMode() === "rules") return classifyWithRules(message);
  try {
    return await classifyWithLlm(message);
  } catch (err) {
    console.error(`[classifier] LLM başarısız (${message.id}), kurallara düşülüyor:`, err);
    return classifyWithRules(message);
  }
}
