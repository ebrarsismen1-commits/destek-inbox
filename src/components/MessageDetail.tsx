"use client";

import { useState } from "react";
import {
  CATEGORY_LABELS,
  CHANNEL_ICONS,
  CHANNEL_LABELS,
  LOW_CONFIDENCE,
  SENTIMENT_LABELS,
  TEAM_LABELS,
  UI,
} from "@/lib/labels";
import { TEAMS, type Message, type Team } from "@/lib/types";
import { ConfidenceBar, PriorityBadge, Tag } from "./Badges";

interface Props {
  message: Message;
  analyzing: boolean;
  onReanalyze: () => void;
  onTeamChange: (team: Team) => void;
  onSend: (reply: string) => void;
}

const dateFmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });

export function MessageDetail({ message, analyzing, onReanalyze, onTeamChange, onSend }: Props) {
  const { analysis } = message;
  const sent = message.status === "gonderildi";
  // Taslak, mesaj veya analiz değişince sıfırlanır (üst bileşen key ile yeniden mount eder).
  const [draft, setDraft] = useState(message.finalReply ?? analysis?.draftReply ?? "");
  const team = message.assignedTeam ?? analysis?.team;

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>
            {CHANNEL_ICONS[message.channel]} {CHANNEL_LABELS[message.channel]}
          </span>
          <span>·</span>
          <span>{message.customerHandle}</span>
          <span>·</span>
          <span>{dateFmt.format(new Date(message.receivedAt))}</span>
          {message.orderId && <Tag>{`${UI.order}: ${message.orderId}`}</Tag>}
        </div>
        <h2 className="mt-1 text-xl font-bold text-slate-900">{message.customerName}</h2>
        {message.subject && <p className="text-sm font-medium text-slate-700">{message.subject}</p>}
        <p className="mt-1 font-mono text-[11px] text-slate-400">
          {UI.sourceFile}: {message.sourceFile}
        </p>
      </header>

      <blockquote className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-800">
        {message.body}
      </blockquote>

      <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-indigo-900">✨ {UI.analysisTitle}</h3>
          <div className="flex items-center gap-2">
            {analysis && (
              <Tag className={analysis.source === "llm" ? "bg-violet-100 text-violet-800" : "bg-slate-200 text-slate-700"}>
                {analysis.source === "llm" ? UI.sourceLlm : UI.sourceRules}
              </Tag>
            )}
            <button
              onClick={onReanalyze}
              disabled={analyzing}
              className="rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              ↻ {UI.reanalyze}
            </button>
          </div>
        </div>

        {analyzing || !analysis ? (
          <div className="space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-indigo-100" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-indigo-100" />
            <p className="text-xs text-indigo-600">{UI.analyzing}</p>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm xl:grid-cols-5">
              <Field label={UI.category}>{CATEGORY_LABELS[analysis.category]}</Field>
              <Field label={UI.priority}>
                <PriorityBadge priority={analysis.priority} />
              </Field>
              <Field label={UI.team}>
                <select
                  value={team}
                  disabled={sent}
                  onChange={(e) => onTeamChange(e.target.value as Team)}
                  className="w-full max-w-48 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                >
                  {TEAMS.map((t) => (
                    <option key={t} value={t}>
                      {TEAM_LABELS[t]}
                    </option>
                  ))}
                </select>
                {message.assignedTeam && message.assignedTeam !== analysis.team && (
                  <p className="mt-1 text-[11px] text-slate-500">{UI.teamChanged}</p>
                )}
              </Field>
              <Field label={UI.sentiment}>{SENTIMENT_LABELS[analysis.sentiment]}</Field>
              <Field label={UI.confidence}>
                <ConfidenceBar value={analysis.confidence} />
              </Field>
            </dl>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase text-slate-500">{UI.summary}</p>
              <p className="mt-1 text-sm text-slate-800">{analysis.summary}</p>
            </div>
            {analysis.confidence < LOW_CONFIDENCE && !sent && (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                ⚠️ {UI.lowConfidence}
              </p>
            )}
          </>
        )}
      </section>

      {analysis && !analyzing && (
        <section className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="draft">
            {UI.draft}
          </label>
          <textarea
            id="draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            readOnly={sent}
            rows={8}
            className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm leading-relaxed text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 read-only:bg-slate-50"
          />
          {sent ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
              ✓ {UI.sentInfo}
            </p>
          ) : (
            <div className="flex justify-end">
              <button
                onClick={() => onSend(draft)}
                disabled={!draft.trim()}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {UI.approveSend} →
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-900">{children}</dd>
    </div>
  );
}
