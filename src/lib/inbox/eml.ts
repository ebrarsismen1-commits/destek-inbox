// Minimal .eml (RFC 5322 / MIME) okuyucu: başlıklar, RFC 2047 kodlu kelimeler, multipart içinden text/plain,
// base64 ve quoted-printable gövde. Ek dosyalar yok sayılır.

export interface ParsedEmail {
  from: string;
  subject: string;
  date?: string;
  body: string;
}

function decodeBytes(bytes: Uint8Array, charset = "utf-8"): string {
  try {
    return new TextDecoder(charset.toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function qpToBytes(input: string, headerMode = false): Uint8Array {
  const text = headerMode ? input.replace(/_/g, " ") : input.replace(/=\r?\n/g, "");
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3))) {
      out.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out.push(...Buffer.from(text[i], "utf8"));
    }
  }
  return Uint8Array.from(out);
}

export function decodeHeader(value: string): string {
  return value
    .replace(/\?=\s+=\?/g, "?==?") // ardışık kodlu kelimeler arasındaki boşluk atılır
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset: string, enc: string, data: string) =>
      enc.toUpperCase() === "B"
        ? decodeBytes(Buffer.from(data, "base64"), charset)
        : decodeBytes(qpToBytes(data, true), charset),
    );
}

function splitHeaders(raw: string): { headers: Map<string, string>; body: string } {
  const idx = raw.search(/\n\n/);
  const head = idx === -1 ? raw : raw.slice(0, idx);
  const body = idx === -1 ? "" : raw.slice(idx + 2);
  const headers = new Map<string, string>();
  let last = "";
  for (const line of head.split("\n")) {
    if (/^\s/.test(line) && last) {
      headers.set(last, `${headers.get(last)} ${line.trim()}`);
    } else {
      const colon = line.indexOf(":");
      if (colon > 0) {
        last = line.slice(0, colon).trim().toLowerCase();
        headers.set(last, line.slice(colon + 1).trim());
      }
    }
  }
  return { headers, body };
}

function param(header: string | undefined, name: string): string | undefined {
  return header?.match(new RegExp(`${name}="?([^";]+)"?`, "i"))?.[1];
}

/** Bir MIME bölümünden okunabilir metni çıkarır; bulamazsa null. */
function extractText(raw: string): { text: string; html: boolean } | null {
  const { headers, body } = splitHeaders(raw);
  const type = headers.get("content-type") ?? "text/plain";
  const mime = type.split(";")[0].trim().toLowerCase();

  if (mime.startsWith("multipart/")) {
    const boundary = param(type, "boundary");
    if (!boundary) return null;
    const parts = body.split(`--${boundary}`).slice(1).filter((p) => !p.startsWith("--"));
    const results = parts.map((p) => extractText(p.replace(/^\n/, ""))).filter((r) => r !== null);
    return results.find((r) => !r.html) ?? results[0] ?? null;
  }
  if (!mime.startsWith("text/")) return null;

  const charset = param(type, "charset") ?? "utf-8";
  const encoding = (headers.get("content-transfer-encoding") ?? "").toLowerCase();
  const bytes =
    encoding === "base64"
      ? Buffer.from(body.replace(/\s+/g, ""), "base64")
      : encoding === "quoted-printable"
        ? qpToBytes(body)
        : Buffer.from(body, "utf8");
  return { text: decodeBytes(bytes, charset), html: mime === "text/html" };
}

function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/div)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function parseEml(source: string): ParsedEmail {
  const raw = source.replace(/\r\n/g, "\n");
  const { headers } = splitHeaders(raw);
  const extracted = extractText(raw);
  const body = extracted ? (extracted.html ? htmlToText(extracted.text) : extracted.text) : "";
  return {
    from: decodeHeader(headers.get("from") ?? ""),
    subject: decodeHeader(headers.get("subject") ?? ""),
    date: headers.get("date"),
    // Alıntılanmış önceki yazışmaları at.
    body: body
      .split("\n")
      .filter((l) => !l.startsWith(">"))
      .join("\n")
      .trim(),
  };
}
