"""
Discord Interactions Webhook. v4
Читает активного бота из таблицы bots.
Slash-команда /ku → "Привет!"
"""

import os
import json
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Signature-Ed25519, X-Signature-Timestamp",
}


def get_active_bot():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute("SELECT token, app_id, public_key, name FROM bots WHERE is_active=TRUE LIMIT 1")
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return None
    return {"token": row[0], "app_id": row[1], "public_key": row[2], "name": row[3]}


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
        print(f"[verify] {e}")
        return False


def handler(event: dict, context) -> dict:
    """Обработчик Discord Interactions — работает с активным ботом из БД."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    raw_headers = event.get("headers", {}) or {}
    headers = {k.lower(): v for k, v in raw_headers.items()}
    body_str = event.get("body") or ""

    bot = get_active_bot()

    if method == "GET":
        return {
            "statusCode": 200,
            "headers": CORS,
            "body": json.dumps({
                "status": "online" if bot else "no_active_bot",
                "bot_name": bot["name"] if bot else None,
                "app_id": bot["app_id"] if bot else None,
            }),
        }

    if method == "POST":
        if not bot:
            return {"statusCode": 503, "headers": CORS, "body": json.dumps({"error": "Нет активного бота"})}

        public_key = bot["public_key"].strip()
        sig = headers.get("x-signature-ed25519", "")
        ts = headers.get("x-signature-timestamp", "")

        if not public_key:
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Public key not set"})}
        if not sig or not ts:
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Missing signature"})}
        if not verify_discord_signature(public_key, sig, ts, body_str):
            print("[handler] Invalid signature")
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Invalid signature"})}

        try:
            data = json.loads(body_str)
        except Exception:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Bad JSON"})}

        interaction_type = data.get("type")

        if interaction_type == 1:
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"type": 1}),
            }

        if interaction_type == 2:
            cmd_name = data.get("data", {}).get("name", "")
            print(f"[handler] cmd={cmd_name} bot={bot['name']}")
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
