"""
Discord бот на основе Interactions Webhook.
Slash-команда /ку → "Привет!"
Discord сам присылает запросы на этот endpoint — постоянное соединение не нужно.
"""

import os
import json
import hashlib
import hmac

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Signature-Ed25519, X-Signature-Timestamp",
}


def verify_discord_signature(public_key: str, signature: str, timestamp: str, body: str) -> bool:
    from nacl.signing import VerifyKey
    from nacl.exceptions import BadSignatureError
    try:
        vk = VerifyKey(bytes.fromhex(public_key))
        vk.verify((timestamp + body).encode(), bytes.fromhex(signature))
        return True
    except BadSignatureError:
        return False
    except Exception:
        return False


def handler(event: dict, context) -> dict:
    """Обработчик Discord Interactions — отвечает на slash-команды без постоянного подключения."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    headers = event.get("headers", {})
    body_str = event.get("body") or ""

    # GET — статус
    if method == "GET":
        public_key = os.environ.get("DISCORD_PUBLIC_KEY", "")
        app_id = os.environ.get("DISCORD_APP_ID", "")
        return {
            "statusCode": 200,
            "headers": CORS,
            "body": json.dumps({
                "status": "online",
                "running": True,
                "app_id": app_id[:8] + "..." if app_id else "не настроен",
                "public_key_set": bool(public_key),
            }),
        }

    if method == "POST":
        public_key = os.environ.get("DISCORD_PUBLIC_KEY", "")

        # Верификация подписи Discord
        if public_key:
            sig = headers.get("x-signature-ed25519", "") or headers.get("X-Signature-Ed25519", "")
            ts = headers.get("x-signature-timestamp", "") or headers.get("X-Signature-Timestamp", "")
            if sig and ts:
                if not verify_discord_signature(public_key, sig, ts, body_str):
                    return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Invalid signature"})}

        try:
            data = json.loads(body_str)
        except Exception:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Bad JSON"})}

        interaction_type = data.get("type")

        # Тип 1 — PING (верификация webhook от Discord)
        if interaction_type == 1:
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"type": 1}),
            }

        # Тип 2 — APPLICATION_COMMAND (slash команда)
        if interaction_type == 2:
            cmd_name = data.get("data", {}).get("name", "")

            if cmd_name == "ку":
                return {
                    "statusCode": 200,
                    "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({
                        "type": 4,
                        "data": {"content": "Привет!"},
                    }),
                }

            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({
                    "type": 4,
                    "data": {"content": "Неизвестная команда"},
                }),
            }

    return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"})}
