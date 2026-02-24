"""
Регистрация slash-команд Discord бота. v2
Вызывается один раз — POST / для регистрации всех команд.
"""

import os
import json
import urllib.request

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


def handler(event: dict, context) -> dict:
    """Регистрирует slash-команды бота в Discord API."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    raw_token = os.environ.get("DISCORD_BOT_TOKEN", "")
    # Если в секрет попало описание — берём последнее слово (сам токен)
    token = raw_token.strip().split()[-1] if raw_token.strip() else ""
    app_id = os.environ.get("DISCORD_APP_ID", "") or "1475679383401529617"

    if not token or not app_id:
        return {
            "statusCode": 500,
            "headers": CORS,
            "body": json.dumps({"error": "DISCORD_BOT_TOKEN или DISCORD_APP_ID не настроены"}),
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