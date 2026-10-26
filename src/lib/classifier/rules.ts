import type { Analysis, Category, Message, Priority, Sentiment, Team } from "../types";

// Anahtar kelime tabanlı yedek sınıflandırıcı. LLM yokken (demo modu) veya LLM hata verdiğinde devreye girer.
// Kelimeler küçük harf ve Türkçe locale ile karşılaştırılır; kök eşleşmesi için kısaltılmış biçimler kullanılır.

const CATEGORY_KEYWORDS: Record<Exclude<Category, "diger">, string[]> = {
  siparis_kargo: ["kargo", "teslim", "gelmedi", "ulaşmadı", "sipariş", "adres", "kurye", "takip", "transfer merkez"],
  iade_degisim: ["iade", "değiş", "küçük geldi", "büyük geldi", "yanlış ürün", "numara", "beden", "geri gönder"],
  odeme_fatura: ["çekim", "parası", "para iade", "ödeme", "fatura", "kart", "taksit", "ekstre", "para", "tl", "ücret", "vergi"],
  urun_bilgisi: ["stok", "stoğ", "tekrar stoğa", "özellik", "bedeni ne zaman", "garanti", "kaç bar", "dahil mi", "renk", "indirim yapıyor", "toplu sipariş"],
  teknik_sorun: ["donuyor", "uygulama", "hata", "buton", "çalışmıyor", "açılmıyor", "kampanya kodu", "geçersiz", "ekran"],
  hesap: ["şifre", "hesab", "giriş", "sıfırlama", "kvkk", "üyelik", "kişisel veri"],
  sikayet: ["rezalet", "dolandırıcı", "berbat", "şikayet", "hakem heyet", "üçüncü kez", "yorumlara yazacağım", "kırık geldi"],
};

const CATEGORY_TEAM: Record<Category, Team> = {
  siparis_kargo: "lojistik",
  iade_degisim: "iade_birimi",
  odeme_fatura: "finans",
  urun_bilgisi: "musteri_iliskileri",
  teknik_sorun: "teknik_destek",
  hesap: "teknik_destek",
  sikayet: "musteri_iliskileri",
  diger: "musteri_iliskileri",
};

const ANGRY = ["rezalet", "dolandırıcı", "berbat", "!!", "hakem heyet", "yeter", "skandal", "herkese yazacağım"];
const NEGATIVE = ["gelmedi", "olmuyor", "sorun", "kırık", "yanlış", "hâlâ", "hala", "maalesef", "geçersiz", "donuyor"];
const POSITIVE = ["teşekkür", "harika", "memnun", "beğendim", "özenli", "kibar", "👏", "🌸"];
const URGENT = ["acil", "hemen", "iki kez çekim", "teslim edildi", "hakem heyet", "dolandırıcı", "kvkk"];

const DRAFTS: Record<Category, string> = {
  siparis_kargo:
    "Siparişinizle ilgili yaşadığınız gecikme için özür dileriz. Kargonuzun durumunu lojistik ekibimizle birlikte inceliyoruz ve en geç 24 saat içinde size güncel teslimat bilgisini ileteceğiz.",
  iade_degisim:
    "İade/değişim talebiniz alındı. Hesabım > Siparişlerim bölümünden ücretsiz iade kodunuzu oluşturabilirsiniz. Ürün depomuza ulaştığında değişim ürününüz hemen kargoya verilecektir.",
  odeme_fatura:
    "Ödeme/fatura talebinizi finans ekibimize ilettik. Gerekli kontrol yapıldıktan sonra 1-3 iş günü içinde işleminiz tamamlanacak ve size bilgi verilecektir.",
  urun_bilgisi:
    "İlginiz için teşekkür ederiz! Sorduğunuz ürünle ilgili detayları ürün ekibimizden alarak kısa süre içinde size ileteceğiz.",
  teknik_sorun:
    "Yaşadığınız teknik sorun için özür dileriz. Teknik ekibimiz konuyu inceliyor. Bu sırada uygulamayı kapatıp yeniden açmanızı veya web sitemiz üzerinden işlem yapmayı denemenizi öneririz.",
  hesap:
    "Hesabınızla ilgili talebinizi aldık. Güvenliğiniz için kimlik doğrulamasının ardından işleminizi gerçekleştirip sizi bilgilendireceğiz.",
  sikayet:
    "Yaşadığınız olumsuz deneyim için içtenlikle özür dileriz. Talebiniz öncelikli olarak müşteri ilişkileri yöneticimize iletildi; bugün içinde sizinle iletişime geçilecektir.",
  diger: "Mesajınız için teşekkür ederiz. Talebinizi ilgili ekibimize ilettik, en kısa sürede size dönüş yapacağız.",
};

function countHits(text: string, words: string[]): number {
  return words.reduce((n, w) => (text.includes(w) ? n + 1 : n), 0);
}

export function classifyWithRules(message: Message): Analysis {
  const text = `${message.subject ?? ""} ${message.body}`.toLocaleLowerCase("tr");

  let category: Category = "diger";
  let best = 0;
  let second = 0;
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][]) {
    const hits = countHits(text, words);
    if (hits > best) {
      second = best;
      best = hits;
      category = cat;
    } else if (hits > second) {
      second = hits;
    }
  }

  const angry = countHits(text, ANGRY);
  const negative = countHits(text, NEGATIVE);
  const positive = countHits(text, POSITIVE);
  const sentiment: Sentiment =
    angry > 0 ? "ofkeli" : negative > positive ? "olumsuz" : positive > 0 ? "olumlu" : "notr";

  const urgent = countHits(text, URGENT);
  const priority: Priority =
    urgent > 0 || sentiment === "ofkeli"
      ? "acil"
      : sentiment === "olumsuz" || category === "odeme_fatura"
        ? "yuksek"
        : sentiment === "olumlu"
          ? "dusuk"
          : "orta";

  // Kural tabanlı sonuç hiçbir zaman LLM kadar güvenilir sayılmaz; tavan 0.75.
  const margin = best - second;
  const confidence = best === 0 ? 0.3 : Math.min(0.75, 0.4 + 0.08 * best + 0.05 * margin);

  const firstName = message.customerName.split(" ")[0];
  const orderRef = message.orderId ? `\n\nReferans: ${message.orderId} numaralı sipariş.` : "";

  return {
    category,
    priority,
    team: CATEGORY_TEAM[category],
    sentiment,
    summary: summarize(message.body),
    draftReply: `Merhaba ${firstName},\n\n${DRAFTS[category]}${orderRef}\n\nSaygılarımızla,\nMüşteri Hizmetleri`,
    confidence: Math.round(confidence * 100) / 100,
    source: "rules",
    analyzedAt: new Date().toISOString(),
  };
}

function summarize(body: string): string {
  const firstSentence = body.split(/(?<=[.!?])\s/)[0] ?? body;
  return firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}…` : firstSentence;
}
