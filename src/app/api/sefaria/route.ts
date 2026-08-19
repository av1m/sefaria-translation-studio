import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const endpoint = request.nextUrl.searchParams.get("endpoint");
  if (!endpoint) {
    return Response.json({ error: "Missing endpoint param" }, { status: 400 });
  }

  const url = `https://www.sefaria.org/api/${endpoint}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return Response.json(
        { error: `Sefaria API returned ${res.status}` },
        { status: res.status },
      );
    }
    const data = await res.json();
    return Response.json(data);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}
