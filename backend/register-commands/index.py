"""
Регистрация slash-команд Discord бота. v3
Токен и app_id читаются из БД (bot_settings).
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

COMMANDS = [
    {
        "name": "ku",
        "description": "Бот приветствует тебя!",
        "type": 1,
    }
]


def get_settings():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute("SELECT key, value FROM bot_settings WHERE key IN ('bot_token', 'app_id')")
    rows = {r[0]: r[1] for r in cur.fetchall()}
    cur.close()
    conn.close()
    return rows


def handler(event: dict, context) -> dict:
    """Регистрирует slash-команды бота в Discord API, используя токен из БД."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    settings = get_settings()
    token = settings.get("bot_token", "")
    app_id = settings.get("app_id", "")

    if not token or not app_id:
        return {
            "statusCode": 400,
            "headers": CORS,
            "body": json.dumps({"error": "Токен или App ID не настроены. Добавь их в Настройках на сайте."}),
        }

    url = f"https://discord.com/api/v10/applications/{app_id}/commands"
    results = []

    for cmd in COMMANDS:
        req = urllib.request.Request(
            url,
            data=json.dumps(cmd).encode(),
            headers={
                "Authorization": f"Bot {token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req) as resp:
                body = json.loads(resp.read())
                results.append({"command": cmd["name"], "status": "ok", "id": body.get("id")})
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            results.append({"command": cmd["name"], "status": "error", "detail": err_body})

    return {
        "statusCode": 200,
        "headers": CORS,
        "body": json.dumps({"registered": results}),
    }
