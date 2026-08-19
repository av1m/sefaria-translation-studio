import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const GLOSSARY_PATH = join(process.cwd(), "src/data/glossary.json");

type Glossary = Record<string, string>;

async function loadGlossary(): Promise<Glossary> {
  try {
    const raw = await readFile(GLOSSARY_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function GET() {
  const glossary = await loadGlossary();
  return Response.json(glossary);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { source, french } = body;

    if (!source || !french) {
      return Response.json(
        { error: "Missing source or french" },
        { status: 400 },
      );
    }

    const glossary = await loadGlossary();
    glossary[source] = french;
    await writeFile(GLOSSARY_PATH, JSON.stringify(glossary, null, 2), "utf-8");

    return Response.json(glossary);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
