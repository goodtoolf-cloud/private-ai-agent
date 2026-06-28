"""
FILE: backend/services/code_executor.py
Run Python and JavaScript code in an isolated E2B sandbox.
"""

import httpx
from config import get_settings

settings = get_settings()

E2B_API = "https://api.e2b.dev/sandboxes"


async def execute_code(code: str, language: str = "python") -> dict:
    """
    Execute code in an isolated E2B sandbox.
    Returns: { "stdout": str, "stderr": str, "error": str|None, "success": bool }
    """
    if not settings.e2b_api_key:
        # Fallback: local subprocess (less safe — use only if e2b not configured)
        return await _execute_local(code, language)

    headers = {
        "X-API-Key": settings.e2b_api_key,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        # Create sandbox
        create_resp = await client.post(
            E2B_API,
            headers=headers,
            json={"template": "base" if language == "python" else "node"},
        )
        create_resp.raise_for_status()
        sandbox = create_resp.json()
        sandbox_id = sandbox["sandboxId"]

        try:
            # Execute code
            exec_resp = await client.post(
                f"{E2B_API}/{sandbox_id}/code",
                headers=headers,
                json={"code": code, "language": language},
            )
            exec_resp.raise_for_status()
            result = exec_resp.json()

            return {
                "stdout": result.get("stdout", ""),
                "stderr": result.get("stderr", ""),
                "error": result.get("error"),
                "success": not bool(result.get("error")),
                "output": result.get("stdout", "") or result.get("stderr", ""),
            }
        finally:
            # Always cleanup sandbox
            await client.delete(f"{E2B_API}/{sandbox_id}", headers=headers)


async def _execute_local(code: str, language: str) -> dict:
    """Local fallback execution (Python only, basic safety via timeout)."""
    import asyncio
    import tempfile
    import os

    suffix = ".py" if language == "python" else ".js"
    interpreter = "python3" if language == "python" else "node"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, mode="w") as f:
        f.write(code)
        tmp_path = f.name

    try:
        proc = await asyncio.create_subprocess_exec(
            interpreter, tmp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)
        except asyncio.TimeoutError:
            proc.kill()
            return {
                "stdout": "",
                "stderr": "Execution timed out after 30 seconds.",
                "error": "Timeout",
                "success": False,
                "output": "Execution timed out.",
            }

        stdout_str = stdout.decode("utf-8", errors="replace")
        stderr_str = stderr.decode("utf-8", errors="replace")

        return {
            "stdout": stdout_str,
            "stderr": stderr_str,
            "error": stderr_str if proc.returncode != 0 else None,
            "success": proc.returncode == 0,
            "output": stdout_str or stderr_str,
        }
    finally:
        os.unlink(tmp_path)


async def fix_and_retry(code: str, error: str, language: str, ai_fix_fn) -> dict:
    """
    Ask the AI to fix broken code, then re-execute.
    ai_fix_fn(broken_code, error) -> fixed_code (callable)
    """
    fixed_code = await ai_fix_fn(code, error)
    result = await execute_code(fixed_code, language)
    result["fixed_code"] = fixed_code
    return result
