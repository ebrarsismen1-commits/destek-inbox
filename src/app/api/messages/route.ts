import path from "node:path";
import { connection } from "next/server";
import { getAnalysisMode, getModel } from "@/lib/classifier";
import { INBOX_DIR } from "@/lib/inbox/scan";
import { listMessages } from "@/lib/store";
import type { MessagesResponse } from "@/lib/types";

export async function GET() {
  // Cache Components açık: inbox klasörü build anında prerender edilmesin diye isteği dinamik işaretle.
  await connection();
  const { messages, errors } = await listMessages();
  const body: MessagesResponse = {
    messages,
    errors,
    analysisMode: getAnalysisMode(),
    model: getModel(),
    inboxDir: path.relative(process.cwd(), INBOX_DIR) || ".",
  };
  return Response.json(body);
}
