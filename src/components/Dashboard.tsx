"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHANNEL_LABELS,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  STATUS_LABELS,
  TEAM_LABELS,
  UI,
} from "@/lib/labels";
import { CHANNELS, PRIORITIES, STATUSES, TEAMS, type Message, type MessagesResponse, type Team } from "@/lib/types";
import { InboxList } from "./InboxList";
import { MessageDetail } from "./MessageDetail";

const ANALYZE_CONCURRENCY = 4;
const POLL_MS = 15_000;

type Filters = { channel: string; priority: string; team: string; status: string; q: string };
const EMPTY_FILTERS: Filters = { channel: "", priority: "", team: "", status: "", q: "" };

export function Dashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [meta, setMeta] = useState<Omit<MessagesResponse, "messages"> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const replace = useCallback((updated: Message) => {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }, []);

  const analyze = useCallback(
    async (id: string) => {
      setAnalyzing((s) => new Set(s).add(id));
      try {
        const res = await fetch(`/api/messages/${id}/analyze`, { method: "POST" });
        if (res.ok) replace(await res.json());
      } finally {
        setAnalyzing((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }
    },
    [replace],
  );

  // Analiz kuyruğu: yenilemeler arasında aynı mesaj iki kez kuyruğa girmesin diye ref'te tutulur.
  const queue = useRef<string[]>([]);
  const queued = useRef<Set<string>>(new Set());
  const active = useRef(0);

  const pump = useCallback(() => {
    const worker = async () => {
      active.current++;
      while (queue.current.length) {
        const id = queue.current.shift()!;
        await analyze(id);
        queued.current.delete(id);
      }
      active.current--;
    };
    // worker() ilk await'e kadar senkron çalışır: active'i artırır ve kuyruktan bir öğe alır.
    while (active.current < ANALYZE_CONCURRENCY && queue.current.length > 0) worker();
  }, [analyze]);

  const load = useCallback(async () => {
    const res = await fetch("/api/messages");
    if (!res.ok) return;
    const data: MessagesResponse = await res.json();
    setMessages(data.messages);
    setMeta({ analysisMode: data.analysisMode, model: data.model, inboxDir: data.inboxDir, errors: data.errors });
    for (const m of data.messages) {
      if (!m.analysis && !queued.current.has(m.id)) {
        queued.current.add(m.id);
        queue.current.push(m.id);
      }
    }
    pump();
  }, [pump]);

  useEffect(() => {
    // İlk yükleme effect içinde veri çekmek için bilinçli olarak setState tetikler.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const patch = async (id: string, body: object) => {
    const res = await fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) replace(await res.json());
  };

  const visible = useMemo(() => {
    const q = filters.q.toLocaleLowerCase("tr");
    return messages
      .filter((m) => !filters.channel || m.channel === filters.channel)
      .filter((m) => !filters.priority || m.analysis?.priority === filters.priority)
      .filter((m) => !filters.team || (m.assignedTeam ?? m.analysis?.team) === filters.team)
      .filter((m) => !filters.status || m.status === filters.status)
      .filter((m) => !q || `${m.customerName} ${m.body} ${m.subject ?? ""}`.toLocaleLowerCase("tr").includes(q))
      .sort((a, b) => {
        const sentDiff = Number(a.status === "gonderildi") - Number(b.status === "gonderildi");
        if (sentDiff) return sentDiff;
        const pa = a.analysis ? PRIORITY_ORDER[a.analysis.priority] : 9;
        const pb = b.analysis ? PRIORITY_ORDER[b.analysis.priority] : 9;
        return pa - pb || b.receivedAt.localeCompare(a.receivedAt);
      });
  }, [messages, filters]);

  const stats = useMemo(() => {
    const analyzed = messages.filter((m) => m.analysis);
    const open = messages.filter((m) => m.status !== "gonderildi");
    return {
      pending: open.length,
      urgent: open.filter((m) => m.analysis?.priority === "acil").length,
      sent: messages.length - open.length,
      confidence: analyzed.length
        ? Math.round((analyzed.reduce((s, m) => s + m.analysis!.confidence, 0) / analyzed.length) * 100)
        : null,
    };
  }, [messages]);

  const selected = messages.find((m) => m.id === selectedId) ?? null;

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{UI.appTitle}</h1>
            <p className="text-xs text-slate-500">{UI.appSubtitle}</p>
          </div>
          {meta &&
            (meta.analysisMode === "rules" ? (
              <span
                title={UI.rulesTooltip}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-300"
              >
                ⚙️ {UI.rulesBadge}
              </span>
            ) : (
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-800 ring-1 ring-violet-300">
                ✨ {UI.liveBadge} · {meta.model}
              </span>
            ))}
          <button
            onClick={load}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            ↻ {UI.refresh}
          </button>
        </div>
        <div className="flex gap-3">
          <Stat label={UI.statPending} value={stats.pending} />
          <Stat label={UI.statUrgent} value={stats.urgent} tone="text-red-600" />
          <Stat label={UI.statSent} value={stats.sent} tone="text-emerald-600" />
          <Stat label={UI.statConfidence} value={stats.confidence === null ? "—" : `%${stats.confidence}`} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[400px] shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="space-y-2 border-b border-slate-100 p-3">
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder={UI.search}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <FilterSelect label={UI.filterChannel} value={filters.channel} onChange={(channel) => setFilters({ ...filters, channel })}
                options={CHANNELS.map((c) => [c, CHANNEL_LABELS[c]])} />
              <FilterSelect label={UI.filterPriority} value={filters.priority} onChange={(priority) => setFilters({ ...filters, priority })}
                options={PRIORITIES.map((p) => [p, PRIORITY_LABELS[p]])} />
              <FilterSelect label={UI.filterTeam} value={filters.team} onChange={(team) => setFilters({ ...filters, team })}
                options={TEAMS.map((t) => [t, TEAM_LABELS[t]])} />
              <FilterSelect label={UI.filterStatus} value={filters.status} onChange={(status) => setFilters({ ...filters, status })}
                options={STATUSES.map((s) => [s, STATUS_LABELS[s]])} />
            </div>
          </div>
          {meta && meta.errors.length > 0 && (
            <details className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <summary className="cursor-pointer font-semibold">
                ⚠️ {UI.scanErrors} ({meta.errors.length})
              </summary>
              <ul className="mt-1 space-y-1">
                {meta.errors.map((e) => (
                  <li key={e.file}>
                    <span className="font-mono">{e.file}</span>: {e.error}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {meta && messages.length === 0 ? (
              <div className="space-y-2 p-6 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">{UI.emptyInboxTitle}</p>
                <p>{UI.emptyInboxHint}</p>
                <p className="font-mono text-xs text-slate-500">{meta.inboxDir}/</p>
                <p className="text-xs leading-relaxed text-slate-500">{UI.emptyInboxFormats}</p>
              </div>
            ) : (
              <InboxList messages={visible} selectedId={selectedId} analyzing={analyzing} onSelect={setSelectedId} />
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {selected ? (
            <MessageDetail
              key={`${selected.id}:${selected.analysis?.analyzedAt ?? ""}`}
              message={selected}
              analyzing={analyzing.has(selected.id)}
              onReanalyze={() => analyze(selected.id)}
              onTeamChange={(team: Team) => patch(selected.id, { assignedTeam: team })}
              onSend={(reply) => patch(selected.id, { action: "send", finalReply: reply })}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">{UI.selectPrompt}</div>
          )}
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "text-slate-900" }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-1.5 text-center">
      <div className={`text-lg font-bold tabular-nums leading-tight ${tone}`}>{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
    >
      <option value="">
        {label}: {UI.filterAll}
      </option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
