import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Analysis, Status, Team } from "./types";

// Temsilci işlemleri ve analiz sonuçları için kalıcı durum dosyası (varsayılan data/state.json).
// Mesaj içeriği burada tutulmaz; kaynak her zaman inbox klasörüdür.

export interface StateEntry {
  contentHash: string;
  status: Status;
  analysis?: Analysis;
  assignedTeam?: Team;
  finalReply?: string;
  sentAt?: string;
}

type StateFile = Record<string, StateEntry>;

export const STATE_FILE = path.resolve(process.cwd(), process.env.STATE_FILE ?? "data/state.json");

const g = globalThis as unknown as { __destekState?: Promise<StateFile>; __destekWrite?: Promise<void> };

async function load(): Promise<StateFile> {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8")) as StateFile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error(`${STATE_FILE} okunamadı: ${(err as Error).message}`);
  }
}

export function readState(): Promise<StateFile> {
  return (g.__destekState ??= load());
}

/** Kaydı günceller ve dosyayı atomik olarak (geçici dosya + rename) yazar. Yazımlar sıraya alınır. */
export async function writeEntry(id: string, entry: StateEntry): Promise<void> {
  const state = await readState();
  state[id] = entry;
  // Önceki yazım başarısız olsa bile zincir kırılmasın.
  const previous = (g.__destekWrite ?? Promise.resolve()).catch(() => {});
  g.__destekWrite = previous.then(async () => {
    await mkdir(path.dirname(STATE_FILE), { recursive: true });
    const tmp = `${STATE_FILE}.tmp`;
    await writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
    await rename(tmp, STATE_FILE);
  });
  return g.__destekWrite;
}
