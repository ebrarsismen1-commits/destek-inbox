import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CATEGORIES, PRIORITIES, SENTIMENTS, TEAMS, type Analysis, type Message } from "../types";
import { CHANNEL_LABELS } from "../labels";

const AnalysisSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  team: z.enum(TEAMS),
  sentiment: z.enum(SENTIMENTS),
  summary: z.string().min(1),
  draftReply: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const TOOL: Anthropic.Tool = {
  name: "submit_analysis",
  description: "Müşteri mesajının yapılandırılmış analizini kaydeder.",
  input_schema: {
    type: "object",
    properties: {
      category: { type: "string", enum: [...CATEGORIES] },
      priority: { type: "string", enum: [...PRIORITIES] },
      team: { type: "string", enum: [...TEAMS] },
      sentiment: { type: "string", enum: [...SENTIMENTS] },
      summary: { type: "string", description: "Temsilci için tek cümlelik Türkçe özet." },
      draftReply: { type: "string", description: "Müşteriye gönderilecek nazik, kısa Türkçe yanıt taslağı." },
      confidence: { type: "number", description: "Sınıflandırmaya güven, 0 ile 1 arası." },
    },
    required: ["category", "priority", "team", "sentiment", "summary", "draftReply", "confidence"],
  },
};

const SYSTEM = `Bir Türk e-ticaret şirketinin müşteri hizmetleri triyaj asistanısın.
Gelen her mesajı analiz et ve submit_analysis aracını çağır.

Kategoriler: siparis_kargo, iade_degisim, odeme_fatura, urun_bilgisi, teknik_sorun, hesap, sikayet, diger.
Ekipler: lojistik (kargo/teslimat), finans (ödeme, fatura, para iadesi), iade_birimi (ürün iade/değişim),
teknik_destek (uygulama, site, hesap erişimi), musteri_iliskileri (ürün soruları, genel şikâyet, itibar riski).

Öncelik kuralları:
- acil: para kaybı (çift çekim, kayıp kargo), yasal tehdit (hakem heyeti, KVKK), kamuya açık itibar riski, öfkeli müşteri
- yuksek: gecikmiş/hatalı sipariş, tekrar eden şikâyet, ödeme yapamama
- orta: standart iade, bilgi değişikliği
- dusuk: genel ürün sorusu, teşekkür

Yanıt taslağı: müşteriye adıyla hitap et, empati kur, somut bir sonraki adım ve süre ver, uydurma bilgi (takip no, tarih, fiyat) verme.
Belirsizse confidence değerini düşük tut.`;

let client: Anthropic | null = null;

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
}

export async function classifyWithLlm(message: Message): Promise<Analysis> {
  client ??= new Anthropic();

  const content = [
    `Kanal: ${CHANNEL_LABELS[message.channel]}`,
    `Müşteri: ${message.customerName}`,
    message.orderId ? `Sipariş no: ${message.orderId}` : null,
    message.subject ? `Konu: ${message.subject}` : null,
    `Mesaj:\n${message.body}`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.create({
    model: getModel(),
    max_tokens: 1024,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("LLM araç çağrısı döndürmedi");
  }

  const parsed = AnalysisSchema.parse(toolUse.input);
  return { ...parsed, source: "llm", analyzedAt: new Date().toISOString() };
}
