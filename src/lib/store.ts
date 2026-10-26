import { scanInbox } from "./inbox/scan";
import { readState, writeEntry, type StateEntry } from "./state";
import type { InboxItem, Message, ScanError } from "./types";

// Mesajlar inbox klasöründen okunur, temsilci/analiz durumu data/state.json'dan birleştirilir.
// Dosya içeriği değişmişse (contentHash farklı) eski analiz yok sayılır ve mesaj yeniden "yeni" olur.

function merge(item: InboxItem, entry: StateEntry | undefined): Message {
  if (!entry || entry.contentHash !== item.contentHash) return { ...item, status: "yeni" };
  return { ...item, ...entry, contentHash: item.contentHash };
}

export async function listMessages(): Promise<{ messages: Message[]; errors: ScanError[] }> {
  const [{ items, errors }, state] = await Promise.all([scanInbox(), readState()]);
  const messages = items
    .map((item) => merge(item, state[item.id]))
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  return { messages, errors };
}

export async function getMessage(id: string): Promise<Message | undefined> {
  const { messages } = await listMessages();
  return messages.find((m) => m.id === id);
}

type Patch = Partial<Pick<Message, "status" | "analysis" | "assignedTeam" | "finalReply" | "sentAt">>;

export async function updateMessage(id: string, patch: Patch): Promise<Message | undefined> {
  const current = await getMessage(id);
  if (!current) return undefined;
  const next = { ...current, ...patch };
  await writeEntry(id, {
    contentHash: next.contentHash,
    status: next.status,
    analysis: next.analysis,
    assignedTeam: next.assignedTeam,
    finalReply: next.finalReply,
    sentAt: next.sentAt,
  });
  return next;
}
