import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { CHANNELS, type InboxItem, type ScanError } from "../types";
import { parserFor } from "./parsers";

export const INBOX_DIR = path.resolve(process.cwd(), process.env.INBOX_DIR ?? "inbox");

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((e) => !e.name.startsWith("."))
      .map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : Promise.resolve([path.join(dir, e.name)]))),
  );
  return nested.flat();
}

/** inbox/<kanal>/ klasörlerini tarar. Hatalı dosya taramayı durdurmaz, errors listesine eklenir. */
export async function scanInbox(): Promise<{ items: InboxItem[]; errors: ScanError[] }> {
  const items: InboxItem[] = [];
  const errors: ScanError[] = [];

  for (const channel of CHANNELS) {
    const dir = path.join(INBOX_DIR, channel);
    await mkdir(dir, { recursive: true });
    for (const file of await walk(dir)) {
      const relPath = path.relative(INBOX_DIR, file);
      const parse = parserFor(channel, file);
      if (!parse) continue;
      try {
        const [content, info] = await Promise.all([readFile(file, "utf8"), stat(file)]);
        const drafts = parse(content, { channel, relPath, mtime: info.mtime });
        drafts.forEach((draft, index) => {
          if (!draft.body.trim()) return;
          items.push({
            ...draft,
            channel,
            id: sha1(`${relPath}#${index}`).slice(0, 12),
            sourceFile: relPath,
            contentHash: sha1(`${draft.subject ?? ""}\n${draft.body}`).slice(0, 16),
          });
        });
      } catch (err) {
        errors.push({ file: relPath, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  return { items, errors };
}
