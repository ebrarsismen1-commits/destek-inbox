@AGENTS.md

# Birleşik Destek Gelen Kutusu — Hackathon Prototipi

E-ticaret müşteri hizmetleri için tek gelen kutusu. E-posta, WhatsApp, Instagram DM, web formu, uygulama içi chat ve
çağrı merkezi transkriptlerinden gelen talepler kanal klasörlerindeki gerçek dışa aktarım dosyalarından okunur ve tek
listede toplanır. Her mesaj otomatik analiz edilir (kategori, öncelik, hedef ekip, duygu, özet, yanıt taslağı, güven
skoru). Temsilci taslağı düzenleyip tek tıkla onaylar.

## Teknik kararlar

- **Next.js 16 (App Router) + TypeScript + Tailwind v4**, tek repo. Next 16 API'leri eğitim verisinden farklı olabilir:
  kod yazmadan önce `node_modules/next/dist/docs/` altındaki ilgili rehberi okuyun (bkz. AGENTS.md).
  - Route handler'larda `ctx.params` bir Promise'tir; `RouteContext<"/yol/[id]">` tipini kullanın.
  - `cacheComponents` açık: `export const dynamic` gibi segment ayarları **kullanılamaz**. Dosya/state okuyan GET
    handler'larında `await connection()` (next/server) çağırın, yoksa build anında statik prerender edilir.
- **Veritabanı yok, kaynak dosyalardır.**
  - Talepler: `inbox/<kanal>/` (`INBOX_DIR` ile değiştirilebilir). Her `GET /api/messages` isteğinde yeniden taranır;
    arayüz 15 sn'de bir yeniler, yeni dosya otomatik listeye düşer ve analiz edilir.
  - Temsilci durumu ve analiz sonuçları: `data/state.json` (`STATE_FILE`). Mesaj id'si → `{contentHash, status,
    analysis, assignedTeam, finalReply, sentAt}`. Atomik yazılır (tmp + rename), yazımlar sıraya alınır.
  - Mesaj id'si = sha1(göreli dosya yolu + kayıt sırası). Dosya içeriği değişirse `contentHash` tutmaz, mesaj "yeni"
    olur ve yeniden analiz edilir. Dosya taşınır/yeniden adlandırılırsa yeni mesaj sayılır.
  - Okunamayan dosya taramayı durdurmaz; `errors` listesinde döner ve arayüzde uyarı bandında görünür.
  - `inbox/` ve `data/state.json` gerçek müşteri verisi içerir, `.gitignore`'dadır. Commit etmeyin.
- **LLM:** `@anthropic-ai/sdk`. Model `ANTHROPIC_MODEL` ortam değişkeninden okunur (varsayılan `claude-haiku-5-5`).
  Yapılandırılmış çıktı için zorunlu tool use (`submit_analysis`) kullanılır; dönen girdi **her zaman zod ile doğrulanır**.
- **Analiz modu:** `ANTHROPIC_API_KEY` yoksa `src/lib/classifier/rules.ts` anahtar kelime sınıflandırıcısı kullanılır,
  arayüzde "Kural tabanlı analiz" rozeti görünür (`analysisMode: "rules"`). Anahtar eklenince LLM'e geçer. LLM çağrısı
  hata verirse o mesaj için kurallara düşülür. `analyzeMessage()` asla fırlatmaz. Kural sonucunun güveni en fazla 0.75.
- **Gerçek gönderim yok.** "Onayla ve Gönder" yalnızca durumu `gonderildi` yapar ve `sentAt` yazar.
- **Arayüz dili Türkçe.**

## Desteklenen dosya biçimleri (`src/lib/inbox/parsers.ts`)

| Klasör | Dosya | Not |
|---|---|---|
| `email/` | `*.eml` | RFC 2047 başlıklar, multipart → text/plain, base64/quoted-printable, `>` alıntı satırları atılır |
| `whatsapp/` | `*.txt` sohbet dışa aktarımı | `26.10.2026 08:05 - Ad: mesaj` ve `[26.10.26, 08:05:12] Ad: mesaj`. İşletmenin son yanıtından sonraki müşteri mesajları = açık talep |
| `instagram/` | `**/message_1.json` (Meta dışa aktarımı) | Meta'nın latin1-mojibake kodlaması düzeltilir; `title` = müşteri; klasör adı → `@kullanıcı` |
| `web_form/`, `in_app/` (ve diğerleri) | `*.csv`, `*.json` (nesne veya dizi) | Alan adları takma adlarla eşlenir: `mesaj/message/body`, `ad_soyad/name`, `eposta/email/userId`, `konu/subject`, `siparis_no/orderId`, `tarih/createdAt` |
| `call_center/` | `*.txt` transkript | İsteğe bağlı başlık bloğu (`Arayan:`, `Telefon:`, `Tarih:`, `Süre:`, `Sipariş No:`, `Konu:`), boş satır, transkript |

İşletme tarafı gönderici adları `BUSINESS_SENDER_NAMES` (virgülle; varsayılan `Müşteri Hizmetleri,Mağaza,Destek`).
Tarihler `gg.aa.yyyy ss:dd` ise Türkiye saati (+03:00) kabul edilir; tarih yoksa dosyanın değişiklik zamanı kullanılır.
Sipariş no metinde yoksa `TR-12345…` ya da `sipariş no: …` kalıbıyla aranır.

## Klasör yapısı

```
inbox/<kanal>/                     Gerçek talep dosyaları (gitignore). Kanal klasörleri ilk taramada oluşturulur
ornek-inbox/                       Her biçimden örnek dosyalar; `npm run ornek-yukle` ile inbox/'a kopyalanır
data/state.json                    Kalıcı temsilci/analiz durumu (gitignore)
src/lib/types.ts                   Enum dizileri, InboxItem/Message/Analysis tipleri, tek kaynak
src/lib/labels.ts                  Tüm Türkçe arayüz metinleri, etiketler, öncelik renkleri, LOW_CONFIDENCE eşiği
src/lib/inbox/scan.ts              Klasör tarama, id/contentHash üretimi, hata toplama
src/lib/inbox/parsers.ts           Kanal/uzantı → ayrıştırıcı, tarih ve sipariş no çıkarımı
src/lib/inbox/eml.ts               Minimal MIME/.eml okuyucu
src/lib/state.ts                   data/state.json okuma/atomik yazma
src/lib/store.ts                   Tarama + state birleştirme: listMessages / getMessage / updateMessage
src/lib/classifier/index.ts        analyzeMessage(), getAnalysisMode()
src/lib/classifier/llm.ts          Anthropic çağrısı, sistem prompt'u, zod şeması
src/lib/classifier/rules.ts        Anahtar kelime sınıflandırıcısı ve şablon yanıtlar
src/app/api/messages/route.ts              GET  liste + analysisMode + model + inboxDir + errors
src/app/api/messages/[id]/route.ts         PATCH assignedTeam / finalReply / action:"send"
src/app/api/messages/[id]/analyze/route.ts POST (yeniden) analiz
src/components/Dashboard.tsx       İstemci state'i, filtreler, istatistikler, 15 sn yenileme, analiz kuyruğu (4 paralel)
src/components/InboxList.tsx       Sol liste
src/components/MessageDetail.tsx   Sağ panel: analiz kartı, kaynak dosya, ekip seçimi, taslak, gönder
src/components/Badges.tsx          Öncelik rozeti, etiket, güven çubuğu
```

## Kodlama kuralları

- Enum değerleri ASCII snake_case Türkçe anahtarlardır (`siparis_kargo`, `acil`, `iade_birimi`). Yeni bir değer eklerken
  `types.ts` dizisini, `labels.ts` etiketini, LLM sistem prompt'unu ve `rules.ts` eşlemelerini birlikte güncelleyin.
- Yeni bir dosya biçimi eklerken ayrıştırıcıyı `parsers.ts`'e yazın, `parserFor()`'a bağlayın, `ornek-inbox/`'a örnek
  dosya ekleyin ve yukarıdaki tabloyu güncelleyin. Ayrıştırıcı hatada açıklayıcı Türkçe mesajla fırlatmalı.
- Bileşenlere sabit Türkçe metin gömmeyin; `labels.ts` içindeki `UI` ya da etiket haritalarını kullanın.
- Kullanıcı metninde Türkçe karşılaştırma için `toLocaleLowerCase("tr")` kullanın (İ/ı). Alan adı/anahtar
  normalizasyonunda **kullanmayın** (`"userId"` → `"userıd"` olur); `parsers.ts` içindeki `normKey` kullanılır.
- Sunucu kodu yalnızca `src/lib` ve `src/app/api` içinde; bileşenler veriye sadece `/api/messages` üzerinden erişir.
- API anahtarı yalnızca sunucuda okunur; istemciye sadece `analysisMode` ve model adı gider.
- İstek gövdeleri zod ile doğrulanır; hata mesajları Türkçe JSON `{ error }` döner.
- Yeni bağımlılık eklemeyin; prototip için mevcut yığın yeterli.

## Çalıştırma

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY boşsa kural tabanlı analiz kullanılır
npm run ornek-yukle          # isteğe bağlı: örnek dosyaları inbox/'a kopyalar
npm run dev                  # http://localhost:3000
npm run build && npm run lint
```

Durumu sıfırlamak için `data/state.json` dosyasını silin; gelen kutusunu boşaltmak için `inbox/` altını temizleyin.
