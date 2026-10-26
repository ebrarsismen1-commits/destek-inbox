import type { NextRequest } from "next/server";
import { z } from "zod";
import { getMessage, updateMessage } from "@/lib/store";
import { TEAMS, type Message } from "@/lib/types";

const PatchSchema = z.object({
  assignedTeam: z.enum(TEAMS).optional(),
  finalReply: z.string().optional(),
  /** "send": yanıtı gönderildi olarak işaretler. Gerçek kanal entegrasyonu yok. */
  action: z.literal("send").optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/messages/[id]">) {
  const { id } = await ctx.params;
  const message = await getMessage(id);
  if (!message) return Response.json({ error: "Mesaj bulunamadı" }, { status: 404 });

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Geçersiz istek" }, { status: 400 });

  const { action, ...fields } = parsed.data;
  const patch: Partial<Message> = { ...fields };
  if (action === "send") {
    if (!message.analysis) return Response.json({ error: "Mesaj henüz analiz edilmedi" }, { status: 409 });
    patch.status = "gonderildi";
    patch.sentAt = new Date().toISOString();
    patch.finalReply = fields.finalReply ?? message.finalReply ?? message.analysis.draftReply;
  }

  return Response.json(await updateMessage(id, patch));
}
