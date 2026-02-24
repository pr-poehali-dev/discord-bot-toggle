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

    token = "MTQ3NTY3OTM4MzQwMTUyOTYxNw.Gu73qF.3fZQkcckkYvvQh-lre-gXdIE0e2w7S1NimeMUY"
    app_id = "1475679383401529617"

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