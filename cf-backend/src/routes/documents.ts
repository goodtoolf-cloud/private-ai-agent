// FILE: cf-backend/src/routes/documents.ts
import { Hono } from "hono";
import { Env, genId } from "../types";
import { chatComplete } from "../services/ai";
import { uploadFile, makeGeneratedKey } from "../services/storage";
import { saveGeneratedFile, listGeneratedFiles } from "../services/database";

export const documentsRouter = new Hono<{ Bindings: Env }>();

documentsRouter.post("/create", async (c) => {
  const {
    topic,
    format = "pdf",
    instructions = "",
    data = [],
    headers: xlsHeaders = [],
  } = await c.req.json<{
    topic: string;
    format?: string;
    instructions?: string;
    data?: any[][];
    headers?: string[];
  }>();

  if (!topic) return c.json({ error: "topic required" }, 400);

  const id = genId();
  let r2Key: string;
  let filename: string;
  let contentType: string;
  let fileBuffer: ArrayBuffer;

  if (format === "xlsx" || format === "csv") {
    // Generate CSV (Workers can't create binary XLSX)
    const aiPrompt = `Generate a data table for: ${topic}
${instructions}
Return ONLY a CSV with headers on the first row. No explanation, no markdown — just the CSV text.`;

    let csvContent: string;
    if (data.length > 0) {
      const rows = xlsHeaders.length > 0 ? [xlsHeaders, ...data] : data;
      csvContent = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    } else {
      const result = await chatComplete(
        c.env,
        [{ role: "user", content: aiPrompt }],
        "deepseek"
      );
      csvContent = result.text.trim();
      // Strip markdown if present
      const match = csvContent.match(/```(?:csv)?\n?([\s\S]*?)```/);
      if (match) csvContent = match[1].trim();
    }

    filename = `${id}.csv`;
    r2Key = makeGeneratedKey(id, "csv", "documents");
    contentType = "text/csv";
    fileBuffer = new TextEncoder().encode(csvContent).buffer as ArrayBuffer;

  } else if (format === "docx") {
    // Generate markdown document (stored as .md, downloadable)
    const aiPrompt = `Write a complete, professional document about: ${topic}
${instructions}

Use markdown formatting:
# Title
## Section headers
Content paragraphs

Write full, detailed content — not just an outline. Be comprehensive.`;

    const result = await chatComplete(
      c.env,
      [{ role: "user", content: aiPrompt }],
      "deepseek"
    );

    filename = `${id}.md`;
    r2Key = makeGeneratedKey(id, "md", "documents");
    contentType = "text/markdown";
    fileBuffer = new TextEncoder().encode(result.text).buffer as ArrayBuffer;

  } else {
    // PDF — generate as HTML with print styles (browsers can print to PDF)
    const aiPrompt = `Write a complete, professional document about: ${topic}
${instructions}

Format as markdown with clear sections and detailed content.`;

    const result = await chatComplete(
      c.env,
      [{ role: "user", content: aiPrompt }],
      "deepseek"
    );

    const htmlContent = markdownToHtml(result.text, topic);
    filename = `${id}.html`;
    r2Key = makeGeneratedKey(id, "html", "documents");
    contentType = "text/html";
    fileBuffer = new TextEncoder().encode(htmlContent).buffer as ArrayBuffer;
  }

  await uploadFile(c.env, r2Key, fileBuffer, contentType);
  await saveGeneratedFile(c.env, filename, format, topic, r2Key);

  const url = `/api/files/download/${encodeURIComponent(r2Key)}`;

  return c.json({ filename, url, type: format, topic });
});

documentsRouter.get("/", async (c) => {
  const docs = await listGeneratedFiles(c.env);
  const docTypes = new Set(["pdf", "docx", "xlsx", "csv", "md", "html"]);
  return c.json(
    docs
      .filter((d: any) => docTypes.has(d.file_type))
      .map((d: any) => ({
        id: d.id,
        filename: d.filename,
        type: d.file_type,
        description: d.description,
        url: `/api/files/download/${encodeURIComponent(d.r2_key)}`,
        created_at: new Date(d.created_at * 1000).toISOString(),
      }))
  );
});

function markdownToHtml(markdown: string, title: string): string {
  const content = markdown
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])/gm, "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.7; color: #1e293b; }
  h1 { font-size: 2rem; color: #1e3a5f; border-bottom: 2px solid #6366f1; padding-bottom: 0.5rem; }
  h2 { font-size: 1.4rem; color: #2d6a4f; margin-top: 2rem; }
  h3 { font-size: 1.1rem; color: #374151; }
  ul { padding-left: 1.5rem; }
  li { margin: 0.3rem 0; }
  p { margin: 0.75rem 0; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<p>${content}</p>
<hr style="margin-top:3rem; border-color:#e2e8f0;">
<p style="font-size:0.8rem;color:#94a3b8;">Generated by Private AI Agent · ${new Date().toLocaleDateString()}</p>
</body>
</html>`;
}
