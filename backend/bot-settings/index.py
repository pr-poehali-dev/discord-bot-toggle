"""
Хранение настроек бота. При сохранении токена — автоматически
получает app_id и public_key через Discord API.
GET / — получить настройки (токен скрыт)
POST / — сохранить токен, auto-fetch app_id + public_key
"""

import os
import json
import urllib.request
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def upsert(cur, key, value):
    cur.execute("""
        INSERT INTO bot_settings (key, value, updated_at)
        VALUES (%s, %s, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    """, (key, value))


def fetch_bot_info(token: str) -> dict:
    """Получает app_id и public_key из Discord API по токену."""
    req = urllib.request.Request(
        "https://discord.com/api/v10/oauth2/applications/@me",
        headers={"Authorization": f"Bot {token}"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
        return {
            "app_id": str(data.get("id", "")),
            "public_key": data.get("verify_key", ""),
            "bot_name": data.get("name", ""),
        }


def handler(event: dict, context) -> dict:
    """Сохраняет токен бота и автоматически получает app_id и public_key."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")

    if method == "GET":
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT key, value FROM bot_settings WHERE key IN ('bot_token','app_id','public_key','bot_name')")
        settings = {r[0]: r[1] for r in cur.fetchall()}
        cur.close()
        conn.close()
        return {
            "statusCode": 200,
            "headers": CORS,
            "body": json.dumps({
                "bot_token_set": bool(settings.get("bot_token")),
                "bot_token_preview": ("***" + settings["bot_token"][-6:]) if settings.get("bot_token") else "",
                "app_id": settings.get("app_id", ""),
                "public_key": settings.get("public_key", ""),
                "bot_name": settings.get("bot_name", ""),
            }),
        }

    if method == "POST":
        try:
            body = json.loads(event.get("body") or "{}")
        except Exception:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Bad JSON"})}

        token = body.get("bot_token", "").strip()
        if not token:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "bot_token обязателен"})}

        # Получаем данные бота через Discord API
        try:
            info = fetch_bot_info(token)
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": f"Неверный токен: {err}"})}
        except Exception as e:
            return {"statusCode": 500, "headers": CORS, "body": json.dumps({"error": f"Ошибка Discord API: {e}"})}

        conn = get_conn()
        cur = conn.cursor()
        upsert(cur, "bot_token", token)
        upsert(cur, "app_id", info["app_id"])
        upsert(cur, "public_key", info["public_key"])
        if info.get("bot_name"):
            upsert(cur, "bot_name", info["bot_name"])
        conn.commit()
        cur.close()
        conn.close()

        return {
            "statusCode": 200,
            "headers": CORS,
            "body": json.dumps({
                "ok": True,
                "bot_name": info["bot_name"],
                "app_id": info["app_id"],
                "public_key_set": bool(info["public_key"]),
            }),
        }

    return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"})}
