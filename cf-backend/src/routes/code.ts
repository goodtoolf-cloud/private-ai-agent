// FILE: cf-backend/src/routes/code.ts
import { Hono } from "hono";
import { Env, genId } from "../types";
import { chatComplete } from "../services/ai";
import { uploadFile, makeGeneratedKey } from "../services/storage";
import { saveGeneratedFile } from "../services/database";

export const codeRouter = new Hono<{ Bindings: Env }>();

codeRouter.post("/run", async (c) => {
  const {
    code,
    language = "python",
    auto_fix = true,
    max_retries = 3,
  } = await c.req.json<{
    code: string;
    language?: string;
    auto_fix?: boolean;
    max_retries?: number;
  }>();

  if (!code) return c.json({ error: "code required" }, 400);

  // E2B sandbox execution (requires E2B_API_KEY)
  const E2B_KEY = c.env.E2B_API_KEY;
  if (!E2B_KEY) {
    // No sandbox — ask AI to simulate/analyze the code
    const prompt = `Analyze this ${language} code and predict its exact output. 
Show what each line does and what the final output would be.
Do NOT run the code — predict it step by step.

\`\`\`${language}
${code}
\`\`\`

Format:
**Predicted Output:**
\`\`\`
<output here>
\`\`\`
**Explanation:** <brief explanation>`;

    const result = await chatComplete(
      c.env,
      [{ role: "user", content: prompt }],
      "deepseek"
    );

    return c.json({
      success: true,
      stdout: result.text,
      stderr: "",
      output: result.text,
      attempts: 1,
      final_code: code,
      auto_fixed: false,
      note: "Code analyzed by AI (no sandbox configured). Add E2B_API_KEY for real execution.",
    });
  }

  // Real execution via E2B API
  let currentCode = code;
  let attempts = 0;
  let lastResult: any = null;

  for (let i = 0; i <= max_retries; i++) {
    attempts++;
    lastResult = await runViaE2B(E2B_KEY, currentCode, language);

    if (lastResult.success || !auto_fix || i === max_retries) break;

    // Auto-fix via AI
    const fixPrompt = `This ${language} code has an error. Fix ONLY the error. Return ONLY the corrected code with no explanation or markdown:

Code:
${currentCode}

Error:
${lastResult.stderr || lastResult.error || "Unknown error"}`;

    const fixResult = await chatComplete(
      c.env,
      [{ role: "user", content: fixPrompt }],
      "deepseek"
    );

    // Strip markdown code blocks if AI wrapped the code
    let fixed = fixResult.text.trim();
    const codeBlockMatch = fixed.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (codeBlockMatch) fixed = codeBlockMatch[1].trim();
    currentCode = fixed;
  }

  return c.json({
    success: lastResult.success,
    stdout: lastResult.stdout ?? "",
    stderr: lastResult.stderr ?? "",
    output: lastResult.stdout || lastResult.stderr || "",
    attempts,
    final_code: currentCode,
    auto_fixed: currentCode !== code,
  });
});

async function runViaE2B(
  apiKey: string,
  code: string,
  language: string
): Promise<{ success: boolean; stdout: string; stderr: string; error?: string }> {
  try {
    const template = language === "python" ? "base" : "node";

    // Create sandbox
    const createRes = await fetch("https://api.e2b.dev/sandboxes", {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ template }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!createRes.ok) throw new Error(`E2B create failed: ${createRes.status}`);
    const sandbox: any = await createRes.json();
    const sandboxId = sandbox.sandboxId;

    try {
      const execRes = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/code`, {
        method: "POST",
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!execRes.ok) throw new Error(`E2B exec failed: ${execRes.status}`);
      const result: any = await execRes.json();
      return {
        success: !result.error,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        error: result.error,
      };
    } finally {
      // Cleanup sandbox
      fetch(`https://api.e2b.dev/sandboxes/${sandboxId}`, {
        method: "DELETE",
        headers: { "X-API-Key": apiKey },
      }).catch(() => {});
    }
  } catch (e) {
    return { success: false, stdout: "", stderr: String(e), error: String(e) };
  }
}

codeRouter.post("/chart", async (c) => {
  const {
    data,
    chart_type = "bar",
    title = "Chart",
    x_key = "",
    y_key = "",
  } = await c.req.json<{
    data: Record<string, any>[];
    chart_type?: string;
    title?: string;
    x_key?: string;
    y_key?: string;
  }>();

  if (!data || !data.length) return c.json({ error: "data required" }, 400);

  const keys = Object.keys(data[0]);
  const xKey = x_key || keys[0];
  const yKey = y_key || (keys[1] ?? keys[0]);

  // Use QuickChart.io — free, no API key, runs via HTTP
  const chartConfig = buildQuickChartConfig(data, chart_type, title, xKey, yKey);
  const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=800&height=500&backgroundColor=%230f172a`;

  // Fetch the chart image
  try {
    const res = await fetch(chartUrl, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`QuickChart error ${res.status}`);
    const buffer = await res.arrayBuffer();

    const id = genId();
    const r2Key = makeGeneratedKey(id, "png", "charts");
    await uploadFile(c.env, r2Key, buffer, "image/png");
    const url = `/api/files/download/${encodeURIComponent(r2Key)}`;
    const filename = `${id}.png`;

    await saveGeneratedFile(c.env, filename, "png", `${chart_type} chart: ${title}`, r2Key);

    return c.json({ success: true, url, filename });
  } catch (e) {
    // Fallback: return the QuickChart URL directly (requires internet on client)
    return c.json({
      success: true,
      url: chartUrl,
      filename: "chart.png",
      note: "Chart served directly from QuickChart.io",
    });
  }
});

function buildQuickChartConfig(
  data: Record<string, any>[],
  chartType: string,
  title: string,
  xKey: string,
  yKey: string
): object {
  const labels = data.map((d) => String(d[xKey] ?? ""));
  const values = data.map((d) => Number(d[yKey] ?? 0));

  const colors = [
    "#6366f1","#8b5cf6","#a78bfa","#818cf8","#c4b5fd",
    "#60a5fa","#34d399","#f59e0b","#f87171","#fb923c",
  ];

  const type = chartType === "area" ? "line" : chartType;

  return {
    type,
    data: {
      labels,
      datasets: [{
        label: yKey,
        data: values,
        backgroundColor: chartType === "pie"
          ? colors
          : `${colors[0]}cc`,
        borderColor: colors[0],
        borderWidth: 2,
        fill: chartType === "area",
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: colors[0],
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: title, color: "#f1f5f9", font: { size: 16 } },
        legend: { labels: { color: "#94a3b8" } },
      },
      scales: type !== "pie" ? {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
      } : undefined,
    },
  };
}

