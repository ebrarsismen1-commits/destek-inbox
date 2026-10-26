export const CHANNELS = ["email", "whatsapp", "instagram", "web_form", "in_app", "call_center"] as const;
export const CATEGORIES = [
  "siparis_kargo",
  "iade_degisim",
  "odeme_fatura",
  "urun_bilgisi",
  "teknik_sorun",
  "hesap",
  "sikayet",
  "diger",
] as const;
export const PRIORITIES = ["acil", "yuksek", "orta", "dusuk"] as const;
export const TEAMS = ["lojistik", "finans", "iade_birimi", "teknik_destek", "musteri_iliskileri"] as const;
export const SENTIMENTS = ["olumlu", "notr", "olumsuz", "ofkeli"] as const;
export const STATUSES = ["yeni", "analiz_edildi", "gonderildi"] as const;

export type Channel = (typeof CHANNELS)[number];
export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Team = (typeof TEAMS)[number];
export type Sentiment = (typeof SENTIMENTS)[number];
export type Status = (typeof STATUSES)[number];

export interface Analysis {
  category: Category;
  priority: Priority;
  team: Team;
  sentiment: Sentiment;
  summary: string;
  draftReply: string;
  confidence: number;
  source: "llm" | "rules";
  analyzedAt: string;
}

/** Kanal klasöründeki bir dosyadan ayrıştırılmış ham talep. */
export interface InboxItem {
  id: string;
  channel: Channel;
  customerName: string;
  customerHandle: string;
  subject?: string;
  body: string;
  orderId?: string;
  receivedAt: string;
  /** inbox klasörüne göre göreli dosya yolu. */
  sourceFile: string;
  /** İçerik değişince analiz geçersiz sayılır. */
  contentHash: string;
}

export interface Message extends InboxItem {
  status: Status;
  analysis?: Analysis;
  /** Temsilcinin ekibi elle değiştirmesi; analizdeki ekibin üzerine yazar. */
  assignedTeam?: Team;
  /** Temsilcinin düzenlediği yanıt; yoksa analiz taslağı kullanılır. */
  finalReply?: string;
  sentAt?: string;
}

export interface ScanError {
  file: string;
  error: string;
}

export interface MessagesResponse {
  messages: Message[];
  /** "rules": ANTHROPIC_API_KEY yok, kural tabanlı sınıflandırıcı kullanılıyor. */
  analysisMode: "llm" | "rules";
  model: string;
  inboxDir: string;
  errors: ScanError[];
}
