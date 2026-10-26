import type { NextRequest } from "next/server";
import { analyzeMessage } from "@/lib/classifier";
import { getMessage, updateMessage } from "@/lib/store";

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/messages/[id]/analyze">) {
  const { id } = await ctx.params;
  const message = await getMessage(id);
  if (!message) return Response.json({ error: "Mesaj bulunamadı" }, { status: 404 });

  const analysis = await analyzeMessage(message);
  // Yeniden analiz temsilcinin elle yaptığı değişiklikleri sıfırlar; gönderilmiş mesajın durumu korunur.
  const updated = await updateMessage(id, {
    analysis,
    assignedTeam: undefined,
    finalReply: undefined,
    status: message.status === "gonderildi" ? "gonderildi" : "analiz_edildi",
  });
  return Response.json(updated);
}
