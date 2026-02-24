"""
Discord бот на основе Interactions Webhook. v2
Slash-команда /ку → "Привет!"
Discord сам присылает запросы на этот endpoint — постоянное соединение не нужно.
"""

import os
import json

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
    except Exception as e:
        print(f"[verify] exception: {e}")
        return False


def handler(event: dict, context) -> dict:
    """Обработчик Discord Interactions — отвечает на slash-команды без постоянного подключения."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    # Все заголовки в нижнем регистре для единообразия
    raw_headers = event.get("headers", {}) or {}
    headers = {k.lower(): v for k, v in raw_headers.items()}
    body_str = event.get("body") or ""

    print(f"[handler] method={method} headers_keys={list(headers.keys())}")

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
        raw_pk = os.environ.get("DISCORD_PUBLIC_KEY", "")
        public_key = raw_pk.strip().split()[-1] if raw_pk.strip() else ""

        sig = headers.get("x-signature-ed25519", "")
        ts = headers.get("x-signature-timestamp", "")

        print(f"[handler] public_key_set={bool(public_key)} sig={sig[:10] if sig else 'EMPTY'} ts={ts}")

        # Верификация подписи — обязательна
        if not public_key:
            print("[handler] DISCORD_PUBLIC_KEY не настроен — отклоняю запрос")
            return {
                "statusCode": 401,
                "headers": CORS,
                "body": json.dumps({"error": "Public key not configured"}),
            }

        if not sig or not ts:
            print(f"[handler] Подпись отсутствует. Все заголовки: {headers}")
            return {
                "statusCode": 401,
                "headers": CORS,
                "body": json.dumps({"error": "Missing signature headers"}),
            }

        if not verify_discord_signature(public_key, sig, ts, body_str):
            print("[handler] Неверная подпись")
            return {
                "statusCode": 401,
                "headers": CORS,
                "body": json.dumps({"error": "Invalid signature"}),
            }

        try:
            data = json.loads(body_str)
        except Exception:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Bad JSON"})}

        interaction_type = data.get("type")
        print(f"[handler] interaction_type={interaction_type}")

        # Тип 1 — PING (верификация webhook от Discord)
        if interaction_type == 1:
            print("[handler] PING — отвечаю PONG")
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"type": 1}),
            }

        # Тип 2 — APPLICATION_COMMAND (slash команда)
        if interaction_type == 2:
            cmd_name = data.get("data", {}).get("name", "")
            print(f"[handler] команда: {cmd_name}")

            if cmd_name == "ku":
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