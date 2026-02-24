"""
Discord бот — обрабатывает команды и управляет статусом бота.
Команды: !ку → "Привет!"
"""

import os
import json
import threading
import discord

# Глобальный клиент бота и поток
_bot_client = None
_bot_thread = None
_bot_running = False


CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def create_client():
    intents = discord.Intents.default()
    intents.message_content = True
    client = discord.Client(intents=intents)

    @client.event
    async def on_ready():
        print(f"Бот запущен как {client.user}")

    @client.event
    async def on_message(message):
        if message.author == client.user:
            return
        if message.content.lower() == "!ку":
            await message.channel.send("Привет!")

    return client


def handler(event: dict, context) -> dict:
    """Управление Discord ботом: включение, выключение, статус."""
    global _bot_client, _bot_thread, _bot_running

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")

    token = os.environ.get("DISCORD_BOT_TOKEN", "")

    # GET /status
    if method == "GET":
        return {
            "statusCode": 200,
            "headers": CORS,
            "body": json.dumps({
                "running": _bot_running,
                "status": "online" if _bot_running else "offline",
            }),
        }

    # POST /start или /stop
    if method == "POST":
        body = {}
        try:
            body = json.loads(event.get("body") or "{}")
        except Exception:
            pass

        action = body.get("action", "")

        if action == "start":
            if _bot_running:
                return {
                    "statusCode": 200,
                    "headers": CORS,
                    "body": json.dumps({"ok": True, "status": "already_running"}),
                }

            def run_bot():
                global _bot_client, _bot_running
                import asyncio
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                _bot_client = create_client()
                _bot_running = True
                try:
                    loop.run_until_complete(_bot_client.start(token))
                except Exception as e:
                    print(f"Бот остановлен: {e}")
                finally:
                    _bot_running = False

            _bot_thread = threading.Thread(target=run_bot, daemon=True)
            _bot_thread.start()

            return {
                "statusCode": 200,
                "headers": CORS,
                "body": json.dumps({"ok": True, "status": "started"}),
            }

        if action == "stop":
            if _bot_client and _bot_running:
                import asyncio
                asyncio.run_coroutine_threadsafe(_bot_client.close(), _bot_client.loop)
                _bot_running = False
            return {
                "statusCode": 200,
                "headers": CORS,
                "body": json.dumps({"ok": True, "status": "stopped"}),
            }

    return {
        "statusCode": 400,
        "headers": CORS,
        "body": json.dumps({"error": "Unknown action"}),
    }
