"""
FILE: backend/routers/code.py
Code execution, auto-fix, and chart generation.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import GeneratedFile
from services.code_executor import execute_code, fix_and_retry
from services.cloudflare import chat_complete
import uuid, os
from config import get_settings

router = APIRouter()
settings = get_settings()


class CodeRequest(BaseModel):
    code: str
    language: str = "python"
    auto_fix: bool = True
    max_retries: int = 3


class ChartRequest(BaseModel):
    data: list[dict]
    chart_type: str = "bar"  # bar, line, pie, scatter, area
    title: str = "Chart"
    x_key: str = ""
    y_key: str = ""


@router.post("/run")
async def run_code(req: CodeRequest, db: AsyncSession = Depends(get_db)):
    """Execute code and optionally auto-fix errors."""
    result = await execute_code(req.code, req.language)
    attempts = 1
    current_code = req.code

    if not result["success"] and req.auto_fix:
        for i in range(req.max_retries):
            fix_prompt = f"""The following {req.language} code has an error. Fix ONLY the error, return ONLY the corrected code with no explanation:

Code:
```{req.language}
{current_code}
```

Error:
{result['stderr'] or result.get('error', '')}
"""
            fix_result = await chat_complete(
                messages=[{"role": "user", "content": fix_prompt}],
                model_key="deepseek",
            )

            fixed_code = fix_result["text"]
            # Extract code block if wrapped in markdown
            if f"```{req.language}" in fixed_code:
                start = fixed_code.index(f"```{req.language}") + len(f"```{req.language}")
                end = fixed_code.rindex("```")
                fixed_code = fixed_code[start:end].strip()
            elif "```" in fixed_code:
                parts = fixed_code.split("```")
                fixed_code = parts[1].strip() if len(parts) > 1 else fixed_code

            current_code = fixed_code
            result = await execute_code(current_code, req.language)
            attempts += 1

            if result["success"]:
                result["fixed_code"] = current_code
                break

    return {
        "success": result["success"],
        "stdout": result.get("stdout", ""),
        "stderr": result.get("stderr", ""),
        "output": result.get("output", ""),
        "attempts": attempts,
        "final_code": current_code,
        "auto_fixed": current_code != req.code,
    }


@router.post("/chart")
async def generate_chart(req: ChartRequest, db: AsyncSession = Depends(get_db)):
    """Generate a chart image from data using matplotlib."""
    import json

    chart_code = _build_chart_code(req.data, req.chart_type, req.title, req.x_key, req.y_key)

    # Execute the chart code
    result = await execute_code(chart_code, "python")

    if result["success"]:
        # Find the generated image
        chart_file = result.get("output", "").strip()
        if chart_file and os.path.exists(chart_file):
            filename = os.path.basename(chart_file)
            url = f"/generated/images/{filename}"

            gf = GeneratedFile(
                filename=filename,
                file_type="png",
                description=f"{req.chart_type} chart: {req.title}",
                url_path=url,
            )
            db.add(gf)
            await db.commit()

            return {"success": True, "url": url, "filename": filename}

    return {"success": False, "error": result.get("stderr", "Chart generation failed")}


def _build_chart_code(data: list[dict], chart_type: str, title: str, x_key: str, y_key: str) -> str:
    import json
    out_path = os.path.join(settings.generated_dir, "images", f"{uuid.uuid4()}.png")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    keys = list(data[0].keys()) if data else ["x", "y"]
    x = x_key or keys[0]
    y = y_key or (keys[1] if len(keys) > 1 else keys[0])

    return f"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

data = {json.dumps(data)}
x_values = [str(d.get('{x}', '')) for d in data]
y_values = [float(d.get('{y}', 0)) for d in data]

fig, ax = plt.subplots(figsize=(10, 6))
fig.patch.set_facecolor('#0f172a')
ax.set_facecolor('#1e293b')
ax.tick_params(colors='#94a3b8')
ax.xaxis.label.set_color('#94a3b8')
ax.yaxis.label.set_color('#94a3b8')
ax.title.set_color('#f1f5f9')
for spine in ax.spines.values():
    spine.set_edgecolor('#334155')

chart_type = '{chart_type}'

if chart_type == 'bar':
    bars = ax.bar(x_values, y_values, color='#6366f1', edgecolor='#818cf8')
    for bar, val in zip(bars, y_values):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01*max(y_values),
                f'{{val:,.0f}}', ha='center', va='bottom', color='#f1f5f9', fontsize=8)
elif chart_type == 'line':
    ax.plot(x_values, y_values, color='#6366f1', linewidth=2, marker='o', markersize=5)
    ax.fill_between(range(len(y_values)), y_values, alpha=0.2, color='#6366f1')
elif chart_type == 'pie':
    ax.pie(y_values, labels=x_values, autopct='%1.1f%%', colors=['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#818cf8'])
elif chart_type == 'scatter':
    ax.scatter(x_values, y_values, color='#6366f1', s=80, alpha=0.8)
elif chart_type == 'area':
    ax.fill_between(range(len(y_values)), y_values, alpha=0.5, color='#6366f1')
    ax.plot(range(len(y_values)), y_values, color='#818cf8', linewidth=2)

ax.set_title('{title}', fontsize=14, pad=15, color='#f1f5f9')
ax.set_xlabel('{x}', color='#94a3b8')
ax.set_ylabel('{y}', color='#94a3b8')
if chart_type != 'pie':
    plt.xticks(rotation=30, ha='right', color='#94a3b8')
    plt.yticks(color='#94a3b8')
plt.tight_layout()
plt.savefig(r'{out_path}', dpi=150, bbox_inches='tight', facecolor='#0f172a')
plt.close()
print(r'{out_path}')
"""
