import { CATEGORY_LABELS, CHANNEL_ICONS, CHANNEL_LABELS, STATUS_LABELS, TEAM_LABELS, UI } from "@/lib/labels";
import type { Message } from "@/lib/types";
import { PriorityBadge, Tag } from "./Badges";

interface Props {
  messages: Message[];
  selectedId: string | null;
  analyzing: Set<string>;
  onSelect: (id: string) => void;
}

const timeFmt = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

export function InboxList({ messages, selectedId, analyzing, onSelect }: Props) {
  if (messages.length === 0) {
    return <p className="p-6 text-center text-sm text-slate-500">{UI.emptyList}</p>;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {messages.map((m) => {
        const team = m.assignedTeam ?? m.analysis?.team;
        const active = m.id === selectedId;
        return (
          <li key={m.id}>
            <button
              onClick={() => onSelect(m.id)}
              className={`w-full px-4 py-3 text-left transition hover:bg-slate-50 ${
                active ? "bg-indigo-50 hover:bg-indigo-50" : ""
              } ${m.status === "gonderildi" ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span title={CHANNEL_LABELS[m.channel]}>{CHANNEL_ICONS[m.channel]}</span>
                  <span className="truncate text-sm font-semibold text-slate-900">{m.customerName}</span>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{timeFmt.format(new Date(m.receivedAt))}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-600">{m.analysis?.summary ?? m.body}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {analyzing.has(m.id) ? (
                  <span className="animate-pulse text-xs text-indigo-600">{UI.analyzing}</span>
                ) : m.analysis ? (
                  <>
                    <PriorityBadge priority={m.analysis.priority} />
                    <Tag>{CATEGORY_LABELS[m.analysis.category]}</Tag>
                    {team && <Tag className="bg-indigo-50 text-indigo-700">→ {TEAM_LABELS[team]}</Tag>}
                  </>
                ) : null}
                {m.status === "gonderildi" && <Tag className="bg-emerald-50 text-emerald-700">✓ {STATUS_LABELS.gonderildi}</Tag>}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
