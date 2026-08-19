import { NextRequest } from "next/server";
import { VersionFileStore } from "@/lib/version-file-store";

const store = new VersionFileStore();

export async function GET(request: NextRequest) {
  const indexTitle = request.nextUrl.searchParams.get("indexTitle");
  if (!indexTitle) {
    return Response.json({ error: "Missing indexTitle" }, { status: 400 });
  }

  const data = await store.load(indexTitle);
  if (!data) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(data);
}

export async function POST(request: Request) {
  try {
    const { indexTitle, ref, drafts } = await request.json();

    if (!indexTitle || !ref || !drafts) {
      return Response.json(
        { error: "Missing indexTitle, ref, or drafts" },
        { status: 400 },
      );
    }

    await store.save(indexTitle, ref, drafts);
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
