"""
Хранение и чтение настроек бота (токен, app_id, public_key) в БД.
GET / — получить настройки (токен скрыт)
POST / — сохранить настройки
"""

import os
import json
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

KEYS = ["bot_token", "app_id", "public_key"]


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def handler(event: dict, context) -> dict:
    """Сохраняет и возвращает настройки Discord бота."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")

    if method == "GET":
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT key, value FROM bot_settings WHERE key = ANY(%s)", (KEYS,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        settings = {row[0]: row[1] for row in rows}
        # Скрываем токен — показываем только что он установлен
        result = {
            "bot_token_set": bool(settings.get("bot_token")),
            "bot_token_preview": ("***" + settings["bot_token"][-6:]) if settings.get("bot_token") else "",
            "app_id": settings.get("app_id", ""),
            "public_key": settings.get("public_key", ""),
        }
        return {"statusCode": 200, "headers": CORS, "body": json.dumps(result)}

    if method == "POST":
        try:
            body = json.loads(event.get("body") or "{}")
        except Exception:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Bad JSON"})}

        conn = get_conn()
        cur = conn.cursor()
        updated = []

        for key in KEYS:
            val = body.get(key, "").strip()
            if val:
                cur.execute("""
                    INSERT INTO bot_settings (key, value, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                """, (key, val))
                updated.append(key)

        conn.commit()
        cur.close()
        conn.close()

        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "updated": updated})}

    return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"})}
