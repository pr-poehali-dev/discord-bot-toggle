"""
Управление Discord ботами.
GET  /         — список всех ботов
POST /         — добавить бота (только токен, остальное auto-fetch)
POST /activate — активировать бота {id}
POST /delete   — удалить бота {id}
"""

import os
import json
import urllib.request
import psycopg2
import psycopg2.extras

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

COMMANDS = [
    {"name": "ku", "description": "Бот приветствует тебя!", "type": 1},
]


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def fetch_bot_info(token: str) -> dict:
    req = urllib.request.Request(
        "https://discord.com/api/v10/oauth2/applications/@me",
        headers={"Authorization": f"Bot {token}"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
        return {
            "app_id": str(data.get("id", "")),
            "public_key": data.get("verify_key", ""),
            "name": data.get("name", "Бот"),
        }


INTERACTIONS_URL = "https://functions.poehali.dev/a732a48b-2887-4612-a2e4-37497a35d07e"


def set_interactions_url(token: str) -> bool:
    """Программно устанавливает Interactions Endpoint URL через Discord API."""
    req = urllib.request.Request(
        "https://discord.com/api/v10/applications/@me",
        data=json.dumps({"interactions_endpoint_url": INTERACTIONS_URL}).encode(),
        headers={"Authorization": f"Bot {token}", "Content-Type": "application/json"},
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as e:
        print(f"[set_interactions_url] {e}")
        return False


def register_commands(token: str, app_id: str) -> list:
    url = f"https://discord.com/api/v10/applications/{app_id}/commands"
    results = []
    for cmd in COMMANDS:
        req = urllib.request.Request(
            url,
            data=json.dumps(cmd).encode(),
            headers={"Authorization": f"Bot {token}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = json.loads(resp.read())
                results.append({"name": cmd["name"], "ok": True, "id": body.get("id")})
        except urllib.error.HTTPError as e:
            results.append({"name": cmd["name"], "ok": False, "error": e.read().decode()})
    return results


def handler(event: dict, context) -> dict:
    """CRUD для Discord ботов — добавление, активация, удаление."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    path = (event.get("path") or "/").rstrip("/")

    # GET — список ботов
    if method == "GET":
        conn = get_conn()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, name, app_id, is_active, created_at FROM bots ORDER BY created_at ASC")
        bots = [dict(r) for r in cur.fetchall()]
        for b in bots:
            b["created_at"] = b["created_at"].isoformat() if b["created_at"] else ""
        cur.close()
        conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"bots": bots})}

    if method == "POST":
        try:
            body = json.loads(event.get("body") or "{}")
        except Exception:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Bad JSON"})}

        # Добавить нового бота
        if path in ("", "/", "/bots", "/bots/"):
            token = body.get("token", "").strip()
            if not token:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "token обязателен"})}

            try:
                info = fetch_bot_info(token)
            except urllib.error.HTTPError as e:
                err_body = e.read().decode()
                print(f"[add_bot] HTTPError {e.code}: {err_body}")
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": f"Discord API: {e.code} — {err_body}"})}
            except Exception as e:
                print(f"[add_bot] Exception: {type(e).__name__}: {e}")
                return {"statusCode": 500, "headers": CORS, "body": json.dumps({"error": f"{type(e).__name__}: {e}"})}

            conn = get_conn()
            cur = conn.cursor()

            # Проверим — вдруг такой бот уже есть
            cur.execute("SELECT id FROM bots WHERE app_id = %s", (info["app_id"],))
            existing = cur.fetchone()
            if existing:
                cur.execute("UPDATE bots SET token=%s, public_key=%s, updated_at=NOW() WHERE id=%s",
                            (token, info["public_key"], existing[0]))
                bot_id = existing[0]
            else:
                cur.execute(
                    "INSERT INTO bots (name, token, app_id, public_key) VALUES (%s,%s,%s,%s) RETURNING id",
                    (info["name"], token, info["app_id"], info["public_key"])
                )
                bot_id = cur.fetchone()[0]

            # Сразу активируем в БД — ДО set_interactions_url,
            # т.к. Discord сразу шлёт PING на наш webhook при установке URL
            cur.execute("UPDATE bots SET is_active=FALSE")
            cur.execute("UPDATE bots SET is_active=TRUE, updated_at=NOW() WHERE id=%s", (bot_id,))
            conn.commit()
            cur.close()
            conn.close()

            # Авто-установка Interactions URL + регистрация команд
            url_set = set_interactions_url(token)
            cmd_results = register_commands(token, info["app_id"])
            print(f"[add_bot] interactions_url_set={url_set} commands={cmd_results}")

            return {
                "statusCode": 200,
                "headers": CORS,
                "body": json.dumps({
                    "ok": True,
                    "bot": {"id": bot_id, "name": info["name"], "app_id": info["app_id"]},
                    "interactions_url_set": url_set,
                    "commands": cmd_results,
                }),
            }

        # Активировать бота
        if path.endswith("/activate"):
            bot_id = body.get("id")
            if not bot_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "id обязателен"})}
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("UPDATE bots SET is_active=FALSE")
            cur.execute("UPDATE bots SET is_active=TRUE, updated_at=NOW() WHERE id=%s", (bot_id,))
            # Получаем токен активированного бота
            cur.execute("SELECT token, app_id FROM bots WHERE id=%s", (bot_id,))
            row = cur.fetchone()
            conn.commit()
            cur.close()
            conn.close()
            # Переустанавливаем interactions URL и команды
            if row:
                set_interactions_url(row[0])
                register_commands(row[0], row[1])
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # Деактивировать бота
        if path.endswith("/deactivate"):
            bot_id = body.get("id")
            if not bot_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "id обязателен"})}
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("UPDATE bots SET is_active=FALSE, updated_at=NOW() WHERE id=%s", (bot_id,))
            conn.commit()
            cur.close()
            conn.close()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # Удалить бота
        if path.endswith("/delete"):
            bot_id = body.get("id")
            if not bot_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "id обязателен"})}
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("DELETE FROM bots WHERE id=%s", (bot_id,))
            conn.commit()
            cur.close()
            conn.close()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"})}