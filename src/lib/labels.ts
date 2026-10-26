import type { Category, Channel, Priority, Sentiment, Status, Team } from "./types";

// Tüm arayüz metinleri burada; bileşenlere sabit Türkçe metin gömmeyin.

export const CHANNEL_LABELS: Record<Channel, string> = {
  email: "E-posta",
  whatsapp: "WhatsApp",
  instagram: "Instagram DM",
  web_form: "Web Formu",
  in_app: "Uygulama İçi Chat",
  call_center: "Çağrı Merkezi",
};

export const CHANNEL_ICONS: Record<Channel, string> = {
  email: "✉️",
  whatsapp: "💬",
  instagram: "📸",
  web_form: "📝",
  in_app: "📱",
  call_center: "📞",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  siparis_kargo: "Sipariş / Kargo",
  iade_degisim: "İade / Değişim",
  odeme_fatura: "Ödeme / Fatura",
  urun_bilgisi: "Ürün Bilgisi",
  teknik_sorun: "Teknik Sorun",
  hesap: "Hesap",
  sikayet: "Şikâyet",
  diger: "Diğer",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  acil: "Acil",
  yuksek: "Yüksek",
  orta: "Orta",
  dusuk: "Düşük",
};

export const PRIORITY_STYLES: Record<Priority, string> = {
  acil: "bg-red-100 text-red-800 ring-red-300",
  yuksek: "bg-orange-100 text-orange-800 ring-orange-300",
  orta: "bg-amber-50 text-amber-800 ring-amber-200",
  dusuk: "bg-slate-100 text-slate-700 ring-slate-200",
};

export const PRIORITY_ORDER: Record<Priority, number> = { acil: 0, yuksek: 1, orta: 2, dusuk: 3 };

export const TEAM_LABELS: Record<Team, string> = {
  lojistik: "Lojistik",
  finans: "Finans",
  iade_birimi: "İade Birimi",
  teknik_destek: "Teknik Destek",
  musteri_iliskileri: "Müşteri İlişkileri",
};

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  olumlu: "😊 Olumlu",
  notr: "😐 Nötr",
  olumsuz: "🙁 Olumsuz",
  ofkeli: "😡 Öfkeli",
};

export const STATUS_LABELS: Record<Status, string> = {
  yeni: "Yeni",
  analiz_edildi: "Onay bekliyor",
  gonderildi: "Gönderildi",
};

export const LOW_CONFIDENCE = 0.6;

export const UI = {
  appTitle: "Birleşik Destek Gelen Kutusu",
  appSubtitle: "Tüm kanallar tek ekranda, yapay zekâ ile ön analiz",
  rulesBadge: "Kural tabanlı analiz",
  rulesTooltip: "ANTHROPIC_API_KEY tanımlı değil; anahtar kelime sınıflandırıcısı kullanılıyor. Anahtar eklenince LLM'e geçer.",
  liveBadge: "LLM analizi",
  sourceFile: "Kaynak dosya",
  refresh: "Yenile",
  scanErrors: "Okunamayan dosyalar",
  emptyInboxTitle: "Gelen kutusu boş",
  emptyInboxHint: "Talep dosyalarını kanal klasörlerine bırakın; liste 15 saniyede bir yenilenir.",
  emptyInboxFormats:
    "email/*.eml · whatsapp/*.txt (sohbet dışa aktarımı) · instagram/**/message_1.json (Meta dışa aktarımı) · web_form/*.csv|*.json · in_app/*.json · call_center/*.txt (transkript)",
  statPending: "Onay bekleyen",
  statUrgent: "Acil",
  statSent: "Gönderildi",
  statConfidence: "Ort. güven",
  filterAll: "Tümü",
  filterChannel: "Kanal",
  filterPriority: "Öncelik",
  filterTeam: "Ekip",
  filterStatus: "Durum",
  search: "Müşteri veya içerik ara…",
  emptyList: "Filtreye uyan talep yok.",
  selectPrompt: "Detayları görmek için soldan bir talep seçin.",
  analyzing: "Analiz ediliyor…",
  analysisTitle: "Yapay Zekâ Analizi",
  category: "Kategori",
  priority: "Öncelik",
  team: "Hedef ekip",
  sentiment: "Duygu",
  confidence: "Güven",
  summary: "Özet",
  draft: "Yanıt taslağı",
  sourceLlm: "LLM",
  sourceRules: "Kural tabanlı",
  lowConfidence: "Düşük güven — göndermeden önce insan kontrolü önerilir.",
  approveSend: "Onayla ve Gönder",
  reanalyze: "Yeniden analiz et",
  sent: "Gönderildi",
  sentInfo: "Yanıt gönderildi olarak işaretlendi (gerçek gönderim yapılmaz).",
  order: "Sipariş",
  teamChanged: "Ekip elle değiştirildi",
  analyzeError: "Analiz başarısız oldu, tekrar deneyin.",
} as const;
