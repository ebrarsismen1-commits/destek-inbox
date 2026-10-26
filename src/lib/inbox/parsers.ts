import path from "node:path";
import type { Channel } from "../types";
import { parseEml } from "./eml";

// Her kanal klasöründeki dosya biçimleri için ayrıştırıcılar. Bir dosya birden fazla talep üretebilir (CSV/JSON dizisi).

export type Draft = {
  customerName: string;
  customerHandle: string;
  subject?: string;
  body: string;
  orderId?: string;
  receivedAt: string;
};

export interface ParseContext {
  channel: Channel;
  relPath: string;
  mtime: Date;
}

/** Bizim tarafımızdaki gönderici adları (WhatsApp/Instagram dışa aktarımlarında müşteriyi ayırt etmek için). */
const BUSINESS_NAMES = (process.env.BUSINESS_SENDER_NAMES ?? "Müşteri Hizmetleri,Mağaza,Destek")
  .split(",")
  .map((s) => s.trim().toLocaleLowerCase("tr"))
  .filter(Boolean);

const isBusiness = (name: string) => BUSINESS_NAMES.includes(name.trim().toLocaleLowerCase("tr"));

/** "26.10.2026 08:41", "26/10/26, 08:41:12", ISO, RFC 2822 veya epoch ms kabul eder. Türkiye saati varsayılır. */
export function parseDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return new Date(value < 1e12 ? value * 1000 : value).toISOString();
  const s = String(value).trim();
  const tr = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (tr) {
    const [, d, m, y, hh, mm, ss = "00"] = tr;
    const year = y.length === 2 ? `20${y}` : y;
    const iso = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hh.padStart(2, "0")}:${mm}:${ss}+03:00`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  const date = new Date(s);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function findOrderId(text: string): string | undefined {
  return (
    text.match(/\b(TR-\d{5,})\b/)?.[1] ??
    text.match(/sipariş\s*(?:no|numarası|numaram)\s*[:#]?\s*([A-Z0-9-]{5,})/i)?.[1]
  );
}

// ---------- E-posta (.eml) ----------

export function parseEmailFile(content: string, ctx: ParseContext): Draft[] {
  const mail = parseEml(content);
  const addr = mail.from.match(/<([^>]+)>/)?.[1] ?? mail.from.trim();
  const name = mail.from.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || addr;
  return [
    {
      customerName: name,
      customerHandle: addr,
      subject: mail.subject || undefined,
      body: mail.body,
      orderId: findOrderId(`${mail.subject} ${mail.body}`),
      receivedAt: parseDate(mail.date) ?? ctx.mtime.toISOString(),
    },
  ];
}

// ---------- WhatsApp sohbet dışa aktarımı (.txt) ----------

const WA_LINE =
  /^\[?(\d{1,2}[./]\d{1,2}[./]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(?:-\s*)?([^:]{1,60}):\s?(.*)$/;

export function parseWhatsAppFile(content: string, ctx: ParseContext): Draft[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/[‎‏]/g, "").split("\n");
  const entries: { at: string; sender: string; text: string }[] = [];
  for (const line of lines) {
    const m = line.match(WA_LINE);
    if (m) entries.push({ at: m[1], sender: m[2].trim(), text: m[3] });
    else if (entries.length && line.trim()) entries[entries.length - 1].text += `\n${line}`;
  }
  const customer = entries.find((e) => !isBusiness(e.sender));
  if (!customer) throw new Error("Müşteri mesajı bulunamadı (tüm göndericiler işletme adı)");

  // Açık talep: işletmenin son yanıtından sonra müşterinin yazdıkları. Yanıt yoksa tüm müşteri mesajları.
  const lastReply = entries.findLastIndex((e) => isBusiness(e.sender));
  const pending = entries.slice(lastReply + 1).filter((e) => e.sender === customer.sender);
  const open = pending.length ? pending : entries.filter((e) => e.sender === customer.sender);
  const body = open
    .map((e) => e.text.replace(/<(Medya|Media) (dahil edilmedi|omitted)>/i, "[medya]"))
    .join("\n")
    .trim();

  const phoneInName = /^\+?[\d\s()-]{7,}$/.test(customer.sender);
  const fileHint = path.basename(ctx.relPath, ".txt").replace(/^WhatsApp (Sohbeti|Chat)( with| -)?\s*/i, "");
  return [
    {
      customerName: phoneInName ? fileHint || customer.sender : customer.sender,
      customerHandle: phoneInName ? customer.sender : `WhatsApp · ${customer.sender}`,
      body,
      orderId: findOrderId(body),
      receivedAt: parseDate(open[open.length - 1].at) ?? ctx.mtime.toISOString(),
    },
  ];
}

// ---------- Çağrı merkezi transkripti (.txt) ----------

const CALL_HEADER = /^(arayan|müşteri adı|müşteri|telefon|tarih|süre|sipariş(?: no)?|konu)\s*:\s*(.+)$/i;

export function parseCallTranscript(content: string, ctx: ParseContext): Draft[] {
  const text = content.replace(/\r\n/g, "\n").trim();
  const [first, ...rest] = text.split(/\n\s*\n/);
  const headerLines = first.split("\n");
  const hasHeader = headerLines.every((l) => CALL_HEADER.test(l.trim()));
  const meta = new Map<string, string>();
  if (hasHeader) {
    for (const l of headerLines) {
      const [, key, value] = l.trim().match(CALL_HEADER)!;
      meta.set(key.toLocaleLowerCase("tr").replace(/ no$/, ""), value.trim());
    }
  }
  const body = (hasHeader ? rest.join("\n\n") : text).trim();
  if (!body) throw new Error("Transkript boş");
  const duration = meta.get("süre");
  return [
    {
      customerName: meta.get("arayan") ?? meta.get("müşteri adı") ?? meta.get("müşteri") ?? "Bilinmeyen arayan",
      customerHandle: meta.get("telefon") ?? path.basename(ctx.relPath),
      subject: meta.get("konu") ?? `Çağrı transkripti${duration ? ` (${duration})` : ""}`,
      body,
      orderId: meta.get("sipariş") ?? findOrderId(body),
      receivedAt: parseDate(meta.get("tarih")) ?? ctx.mtime.toISOString(),
    },
  ];
}

// ---------- Instagram (Meta veri dışa aktarımı message_*.json) ----------

/** Meta dışa aktarımları UTF-8 baytlarını latin1 karakter olarak yazar ("Ã¼" → "ü"); geri çevirir. */
function fixMetaEncoding(s: string): string {
  if (!/[À-ÿ][\u0080-¿]/.test(s)) return s;
  const fixed = Buffer.from(s, "latin1").toString("utf8");
  return fixed.includes("�") ? s : fixed;
}

interface MetaThread {
  title?: string;
  participants?: { name: string }[];
  messages: { sender_name: string; timestamp_ms: number; content?: string }[];
}

function isMetaThread(v: unknown): v is MetaThread {
  return typeof v === "object" && v !== null && Array.isArray((v as MetaThread).messages) &&
    (v as MetaThread).messages.every((m) => typeof m?.sender_name === "string");
}

function parseMetaThread(thread: MetaThread, ctx: ParseContext): Draft[] {
  const messages = thread.messages
    .map((m) => ({ ...m, sender_name: fixMetaEncoding(m.sender_name), content: fixMetaEncoding(m.content ?? "") }))
    .sort((a, b) => a.timestamp_ms - b.timestamp_ms);
  const title = thread.title ? fixMetaEncoding(thread.title) : undefined;
  const customerName = title ?? messages.find((m) => !isBusiness(m.sender_name))?.sender_name;
  if (!customerName) throw new Error("Müşteri katılımcısı bulunamadı");

  const lastReply = messages.findLastIndex((m) => m.sender_name !== customerName);
  const pending = messages.slice(lastReply + 1).filter((m) => m.sender_name === customerName && m.content);
  const open = pending.length ? pending : messages.filter((m) => m.sender_name === customerName && m.content);
  if (!open.length) throw new Error("Müşteri metin mesajı yok");
  const body = open.map((m) => m.content).join("\n");

  // Meta klasör adı "kullaniciadi_123456789" biçimindedir.
  const folder = path.basename(path.dirname(ctx.relPath));
  const handle = folder && folder !== ctx.channel ? `@${folder.replace(/_\d+$/, "")}` : customerName;
  return [
    {
      customerName,
      customerHandle: handle,
      body,
      orderId: findOrderId(body),
      receivedAt: new Date(open[open.length - 1].timestamp_ms).toISOString(),
    },
  ];
}

// ---------- Genel kayıtlar: web formu / uygulama içi chat (.json, .csv) ----------

const ALIASES = {
  name: ["name", "fullname", "ad_soyad", "adsoyad", "ad", "customername", "musteri", "müşteri"],
  handle: ["email", "e-posta", "eposta", "mail", "phone", "telefon", "userid", "user_id", "kullanici", "username"],
  subject: ["subject", "konu", "title", "baslik", "başlık"],
  body: ["message", "mesaj", "body", "text", "content", "aciklama", "açıklama", "talep"],
  orderId: ["orderid", "order_id", "siparisno", "siparis_no", "sipariş_no", "siparis"],
  date: ["submittedat", "createdat", "created_at", "date", "tarih", "timestamp", "zaman"],
} as const;

/** Alan adı normalizasyonu. Türkçe locale kullanılmaz: "userId" → "userıd" olurdu. */
const normKey = (k: string) => k.replace(/İ/g, "i").toLowerCase().trim().replace(/\s+/g, "_");

function pick(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const [k, v] of Object.entries(record)) {
    if (keys.includes(normKey(k)) && v !== null && v !== "") return String(v);
  }
  return undefined;
}

function recordToDraft(record: Record<string, unknown>, ctx: ParseContext): Draft {
  const body = pick(record, ALIASES.body);
  if (!body) throw new Error(`Mesaj alanı yok (beklenen: ${ALIASES.body.slice(0, 4).join(", ")}…)`);
  const handle = pick(record, ALIASES.handle);
  const dateKey = Object.keys(record).find((k) => (ALIASES.date as readonly string[]).includes(normKey(k)));
  return {
    customerName: pick(record, ALIASES.name) ?? handle ?? "İsimsiz",
    customerHandle: handle ?? "—",
    subject: pick(record, ALIASES.subject),
    body,
    orderId: pick(record, ALIASES.orderId) ?? findOrderId(body),
    receivedAt: parseDate(dateKey ? record[dateKey] : undefined) ?? ctx.mtime.toISOString(),
  };
}

export function parseJsonFile(content: string, ctx: ParseContext): Draft[] {
  const data: unknown = JSON.parse(content);
  if (isMetaThread(data)) return parseMetaThread(data, ctx);
  const records = Array.isArray(data) ? data : [data];
  return records.map((r) => recordToDraft(r as Record<string, unknown>, ctx));
}

/** RFC 4180 CSV: tırnaklı alanlar, alan içi virgül/satır sonu, "" kaçışı. Ayırıcı , veya ; otomatik seçilir. */
export function parseCsvFile(content: string, ctx: ParseContext): Draft[] {
  const text = content.replace(/^﻿/, "");
  const firstLine = text.split("\n")[0];
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);

  const [header, ...data] = rows;
  if (!header) return [];
  return data.map((cells) => recordToDraft(Object.fromEntries(header.map((h, i) => [h.trim(), cells[i]?.trim()])), ctx));
}

/** Kanal klasörü ve uzantıya göre uygun ayrıştırıcıyı seçer; desteklenmeyen dosyada null döner. */
export function parserFor(channel: Channel, file: string): ((c: string, ctx: ParseContext) => Draft[]) | null {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".eml") return parseEmailFile;
  if (ext === ".json") return parseJsonFile;
  if (ext === ".csv") return parseCsvFile;
  if (ext === ".txt") {
    if (channel === "whatsapp") return parseWhatsAppFile;
    if (channel === "call_center") return parseCallTranscript;
    // Diğer kanallarda düz metin: tüm dosya tek mesaj.
    return (content, ctx) => [
      {
        customerName: path.basename(file, ext),
        customerHandle: "—",
        body: content.trim(),
        orderId: findOrderId(content),
        receivedAt: ctx.mtime.toISOString(),
      },
    ];
  }
  return null;
}
