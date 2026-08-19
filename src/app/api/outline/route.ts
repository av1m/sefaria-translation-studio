import { NextRequest } from "next/server";
import { parseRef } from "@/lib/parse-ref";
import { SefariaClient } from "@/lib/sefaria-client";
import { buildOutline } from "@/lib/index-outline";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("indexTitle");
  if (!raw) {
    return Response.json({ error: "Missing indexTitle" }, { status: 400 });
  }

  try {
    const { indexTitle } = parseRef(raw);
    const client = new SefariaClient();
    const outline = await buildOutline(indexTitle, client);
    return Response.json(outline);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}
