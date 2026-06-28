"""
FILE: backend/routers/alerts.py
Background topic monitoring — checks for updates and notifies you.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import MonitorAlert, AlertNotification
from services.searxng import search_web
from services.cloudflare import chat_complete

router = APIRouter()


class AlertCreate(BaseModel):
    topic: str
    query: str
    interval_minutes: int = 60


@router.post("/")
async def create_alert(req: AlertCreate, db: AsyncSession = Depends(get_db)):
    """Create a new monitoring alert for a topic."""
    alert = MonitorAlert(
        topic=req.topic,
        query=req.query,
        interval_minutes=req.interval_minutes,
        is_active=True,
    )
    db.add(alert)
    await db.commit()
    return {"id": alert.id, "topic": req.topic, "message": "Alert created. Monitoring started."}


@router.get("/")
async def list_alerts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MonitorAlert).order_by(MonitorAlert.created_at.desc()))
    alerts = result.scalars().all()
    return [
        {
            "id": a.id,
            "topic": a.topic,
            "query": a.query,
            "interval_minutes": a.interval_minutes,
            "is_active": a.is_active,
            "last_check": a.last_check.isoformat() if a.last_check else None,
            "created_at": a.created_at.isoformat(),
        }
        for a in alerts
    ]


@router.post("/{alert_id}/check")
async def manual_check(alert_id: str, db: AsyncSession = Depends(get_db)):
    """Manually trigger a check for an alert."""
    result = await db.execute(select(MonitorAlert).where(MonitorAlert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    search_results = await search_web(alert.query, num_results=5)

    results_text = "\n".join([
        f"- {r['title']}: {r['content'][:200]}" for r in search_results if r.get("title")
    ])

    summary_prompt = f"""I am monitoring the topic: "{alert.topic}"
Search query: "{alert.query}"

Latest search results:
{results_text}

Previous last result:
{alert.last_result or "No previous check"}

Task:
1. Summarize what is new or changed since last check
2. Flag anything important I should know
3. Keep response concise (3-5 bullet points max)
"""

    ai_result = await chat_complete(
        messages=[{"role": "user", "content": summary_prompt}],
        model_key="llama",
    )
    summary = ai_result["text"]

    # Save notification
    notification = AlertNotification(
        alert_id=alert.id,
        summary=summary,
    )
    db.add(notification)

    # Update alert
    from datetime import datetime
    alert.last_check = datetime.utcnow()
    alert.last_result = results_text[:1000]
    await db.commit()

    return {
        "alert_id": alert_id,
        "topic": alert.topic,
        "summary": summary,
        "sources_checked": len(search_results),
    }


@router.get("/notifications")
async def get_notifications(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AlertNotification)
        .order_by(AlertNotification.created_at.desc())
        .limit(50)
    )
    notifications = result.scalars().all()
    return [
        {
            "id": n.id,
            "alert_id": n.alert_id,
            "summary": n.summary,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifications
    ]


@router.patch("/notifications/{notification_id}/read")
async def mark_read(notification_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AlertNotification).where(AlertNotification.id == notification_id)
    )
    n = result.scalar_one_or_none()
    if n:
        n.is_read = True
        await db.commit()
    return {"success": True}


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MonitorAlert).where(MonitorAlert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    await db.delete(alert)
    await db.commit()
    return {"success": True}
