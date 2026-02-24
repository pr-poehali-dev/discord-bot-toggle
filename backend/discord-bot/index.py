"""
Discord бот на основе Interactions Webhook. v3
Slash-команда /ku → "Привет!"
Public key читается из БД (bot_settings).
"""

import os
import json
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Signature-Ed25519, X-Signature-Timestamp",
}


def get_settings():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute("SELECT key, value FROM bot_settings WHERE key IN ('bot_token', 'app_id', 'public_key')")
    rows = {r[0]: r[1] for r in cur.fetchall()}
    cur.close()
    conn.close()
    return rows


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
    """Обработчик Discord Interactions — читает настройки из БД, отвечает на slash-команды."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    raw_headers = event.get("headers", {}) or {}
    headers = {k.lower(): v for k, v in raw_headers.items()}
    body_str = event.get("body") or ""

    settings = get_settings()

    if method == "GET":
        return {
            "statusCode": 200,
            "headers": CORS,
            "body": json.dumps({
                "status": "online",
                "running": True,
                "token_set": bool(settings.get("bot_token")),
                "app_id_set": bool(settings.get("app_id")),
                "public_key_set": bool(settings.get("public_key")),
            }),
        }

    if method == "POST":
        public_key = settings.get("public_key", "").strip()
        sig = headers.get("x-signature-ed25519", "")
        ts = headers.get("x-signature-timestamp", "")

        print(f"[handler] public_key_set={bool(public_key)} sig={'OK' if sig else 'EMPTY'} ts={'OK' if ts else 'EMPTY'}")

        if not public_key:
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Public key not configured"})}

        if not sig or not ts:
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Missing signature headers"})}

        if not verify_discord_signature(public_key, sig, ts, body_str):
            print("[handler] Неверная подпись")
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Invalid signature"})}

        try:
            data = json.loads(body_str)
        except Exception:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Bad JSON"})}

        interaction_type = data.get("type")
        print(f"[handler] interaction_type={interaction_type}")

        # PING
        if interaction_type == 1:
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"type": 1}),
            }

        # Slash команда
        if interaction_type == 2:
            cmd_name = data.get("data", {}).get("name", "")
            print(f"[handler] команда: {cmd_name}")
            if cmd_name == "ku":
                return {
                    "statusCode": 200,
                    "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"type": 4, "data": {"content": "Привет!"}}),
                }
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"type": 4, "data": {"content": "Неизвестная команда"}}),
            }

    return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"})}
