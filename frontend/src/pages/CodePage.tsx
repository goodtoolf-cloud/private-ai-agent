// FILE: frontend/src/pages/CodePage.tsx
import { useState } from "react";
import { Play, BarChart2, Loader2, CheckCircle, XCircle, Wrench } from "lucide-react";
import { codeAPI } from "../services/api";

const CHART_TYPES = ["bar", "line", "pie", "scatter", "area"];

const SAMPLE_CODE = {
  python: `import math

def fibonacci(n):
    a, b = 0, 1
    result = []
    for _ in range(n):
        result.append(a)
        a, b = b, a + b
    return result

fib = fibonacci(15)
print("Fibonacci:", fib)
print("Sum:", sum(fib))
print("Pi approximation:", math.pi)
`,
  javascript: `function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[Math.floor(arr.length / 2)];
  const left = arr.filter(x => x < pivot);
  const mid = arr.filter(x => x === pivot);
  const right = arr.filter(x => x > pivot);
  return [...quickSort(left), ...mid, ...quickSort(right)];
}

const arr = [64, 34, 25, 12, 22, 11, 90];
console.log("Sorted:", quickSort(arr));
console.log("Length:", arr.length);
`,
};

const SAMPLE_CHART_DATA = [
  { month: "Jan", sales: 4200, expenses: 3100 },
  { month: "Feb", sales: 5800, expenses: 3800 },
  { month: "Mar", sales: 3900, expenses: 2900 },
  { month: "Apr", sales: 7200, expenses: 4100 },
  { month: "May", sales: 8100, expenses: 4800 },
  { month: "Jun", sales: 6500, expenses: 3700 },
];

export default function CodePage() {
  const [tab, setTab] = useState<"code" | "chart">("code");
  const [language, setLanguage] = useState<"python" | "javascript">("python");
  const [code, setCode] = useState(SAMPLE_CODE.python);
  const [autoFix, setAutoFix] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [chartData, setChartData] = useState(JSON.stringify(SAMPLE_CHART_DATA, null, 2));
  const [chartType, setChartType] = useState("bar");
  const [chartTitle, setChartTitle] = useState("Monthly Sales vs Expenses");
  const [xKey, setXKey] = useState("month");
  const [yKey, setYKey] = useState("sales");
  const [generatingChart, setGeneratingChart] = useState(false);
  const [chartUrl, setChartUrl] = useState<string | null>(null);

  const runCode = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await codeAPI.run({ code, language, auto_fix: autoFix });
      setResult(res.data);
    } catch (err: any) {
      setResult({ success: false, output: "Error: " + (err.response?.data?.detail || err.message) });
    } finally {
      setRunning(false);
    }
  };

  const generateChart = async () => {
    setGeneratingChart(true);
    setChartUrl(null);
    try {
      const parsedData = JSON.parse(chartData);
      const res = await codeAPI.chart({
        data: parsedData,
        chart_type: chartType,
        title: chartTitle,
        x_key: xKey,
        y_key: yKey,
      });
      if (res.data.success) setChartUrl(res.data.url);
      else alert("Chart error: " + res.data.error);
    } catch (err: any) {
      alert("Error: " + (err.response?.data?.detail || err.message));
    } finally {
      setGeneratingChart(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Code Execution</h1>
        <p className="text-sm text-slate-400 mt-1">Run Python or JavaScript. Auto-fixes errors. Also generates charts from data.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["code", "chart"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? "bg-primary text-white" : "bg-bg-800 border border-bg-700 text-slate-400 hover:text-white"
            }`}>
            {t === "code" ? "Run Code" : "Generate Chart"}
          </button>
        ))}
      </div>

      {tab === "code" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select className="input w-40" value={language} onChange={(e) => {
              const l = e.target.value as "python" | "javascript";
              setLanguage(l);
              setCode(SAMPLE_CODE[l]);
            }}>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input type="checkbox" checked={autoFix} onChange={(e) => setAutoFix(e.target.checked)} className="accent-primary" />
              Auto-fix errors
            </label>
          </div>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="input font-mono text-sm h-56 resize-none"
            spellCheck={false}
          />

          <button onClick={runCode} disabled={running} className="btn-primary flex items-center gap-2">
            {running ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
            {running ? "Running..." : "Run Code"}
          </button>

          {result && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle size={16} className="text-success" />
                ) : (
                  <XCircle size={16} className="text-danger" />
                )}
                <span className={result.success ? "text-success text-sm" : "text-danger text-sm"}>
                  {result.success ? "Success" : "Failed"}
                </span>
                {result.attempts > 1 && (
                  <span className="badge bg-yellow-900 text-yellow-300">
                    <Wrench size={10} /> Fixed after {result.attempts} attempt{result.attempts > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {result.output && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Output</p>
                  <pre className="bg-bg-900 border border-bg-700 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                    {result.output}
                  </pre>
                </div>
              )}

              {result.auto_fixed && result.final_code && (
                <div>
                  <p className="text-xs text-yellow-400 mb-1">⚡ Auto-fixed code:</p>
                  <pre className="bg-bg-900 border border-yellow-900/50 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                    {result.final_code}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "chart" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 mb-1.5 block">Chart Type</label>
              <select className="input" value={chartType} onChange={(e) => setChartType(e.target.value)}>
                {CHART_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1.5 block">Title</label>
              <input className="input" value={chartTitle} onChange={(e) => setChartTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1.5 block">X Axis Key</label>
              <input className="input" value={xKey} onChange={(e) => setXKey(e.target.value)} placeholder="month" />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1.5 block">Y Axis Key</label>
              <input className="input" value={yKey} onChange={(e) => setYKey(e.target.value)} placeholder="sales" />
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-1.5 block">Data (JSON array of objects)</label>
            <textarea
              className="input font-mono text-xs h-40 resize-none"
              value={chartData}
              onChange={(e) => setChartData(e.target.value)}
            />
          </div>

          <button onClick={generateChart} disabled={generatingChart} className="btn-primary flex items-center gap-2">
            {generatingChart ? <Loader2 size={16} className="spin" /> : <BarChart2 size={16} />}
            {generatingChart ? "Generating chart..." : "Generate Chart"}
          </button>

          {chartUrl && (
            <div className="card space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm">Chart</h3>
                <a href={chartUrl} download className="text-xs text-primary-light hover:underline">Download</a>
              </div>
              <img src={chartUrl} alt="Generated chart" className="w-full rounded-lg" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
