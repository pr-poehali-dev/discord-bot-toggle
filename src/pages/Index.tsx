import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const BOT_API = "https://functions.poehali.dev/a732a48b-2887-4612-a2e4-37497a35d07e";
const SETTINGS_API = "https://functions.poehali.dev/d8f68ff6-0557-4d53-80c0-55c6ae8278ee";
const REGISTER_API = "https://functions.poehali.dev/91266527-c06b-488f-9f43-224096af875d";

type Tab = "dashboard" | "status" | "commands" | "logs" | "settings";

interface LogEntry {
  id: number;
  time: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Панель", icon: "LayoutDashboard" },
  { id: "status", label: "Статус", icon: "Activity" },
  { id: "commands", label: "Команды", icon: "Terminal" },
  { id: "logs", label: "Логи", icon: "ScrollText" },
  { id: "settings", label: "Настройки", icon: "Settings" },
];

const COMMANDS_INITIAL = [
  { command: "/ku", description: "Приветствие", response: "Привет!", enabled: true },
];

const INITIAL_LOGS: LogEntry[] = [
  { id: 1, time: "12:00:01", level: "info", message: "Бот запущен и готов к работе" },
  { id: 2, time: "12:00:02", level: "success", message: "Подключение к Discord API установлено" },
  { id: 3, time: "12:00:05", level: "info", message: "Slash-команда /ku зарегистрирована" },
];

export default function Index() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [botOnline, setBotOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [dark, setDark] = useState(true);
  const [commands, setCommands] = useState(COMMANDS_INITIAL);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(INITIAL_LOGS.length + 1);

  // Настройки бота
  const [botToken, setBotToken] = useState("");
  const [savedInfo, setSavedInfo] = useState<{bot_token_set?: boolean; bot_token_preview?: string; app_id?: string; public_key?: string; bot_name?: string} | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState<string>("");

  useEffect(() => {
    fetch(SETTINGS_API)
      .then(r => r.json())
      .then(data => setSavedInfo(data))
      .catch(() => {});
  }, []);

  const saveSettings = async () => {
    if (!botToken.trim()) return;
    setSettingsSaving(true);
    setSettingsSaved(false);
    setSettingsError("");
    try {
      const res = await fetch(SETTINGS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: botToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSettingsError(data.error || "Неверный токен");
        addLog("error", "Ошибка: " + (data.error || "Неверный токен"));
      } else {
        const fresh = await fetch(SETTINGS_API).then(r => r.json());
        setSavedInfo(fresh);
        setBotToken("");
        setSettingsSaved(true);
        addLog("success", `Бот «${data.bot_name}» подключён`);
        setTimeout(() => setSettingsSaved(false), 4000);
      }
    } catch {
      setSettingsError("Ошибка подключения");
    }
    setSettingsSaving(false);
  };

  const registerCommands = async () => {
    setRegistering(true);
    setRegisterResult("");
    try {
      const data = await fetch(REGISTER_API).then(r => r.json());
      if (data.registered?.[0]?.status === "ok") {
        setRegisterResult("✓ Команда /ku зарегистрирована!");
        addLog("success", "Slash-команда /ku зарегистрирована в Discord");
      } else {
        setRegisterResult("Ошибка: " + JSON.stringify(data));
        addLog("error", "Ошибка регистрации команды");
      }
    } catch {
      setRegisterResult("Ошибка подключения");
    }
    setRegistering(false);
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (level: LogEntry["level"], message: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [...prev, { id: logIdRef.current++, time, level, message }]);
  };

  const toggleBot = async () => {
    setLoading(true);
    try {
      const action = botOnline ? "stop" : "start";
      const res = await fetch(BOT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      const next = action === "start";
      setBotOnline(next);
      addLog(next ? "success" : "warn", next ? "Бот включён" : "Бот выключен");
      if (data.status) addLog("info", `Статус: ${data.status}`);
    } catch {
      addLog("error", "Ошибка подключения к боту");
    }
    setLoading(false);
  };

  const toggleCommand = (index: number) => {
    const cmd = commands[index];
    setCommands((prev) =>
      prev.map((c, i) => (i === index ? { ...c, enabled: !c.enabled } : c))
    );
    addLog(
      !cmd.enabled ? "success" : "warn",
      `Команда ${cmd.command} ${!cmd.enabled ? "включена" : "выключена"}`
    );
  };

  const levelColor: Record<LogEntry["level"], string> = {
    info: "text-blue-400",
    warn: "text-yellow-400",
    error: "text-red-400",
    success: "text-emerald-400",
  };

  const levelLabel: Record<LogEntry["level"], string> = {
    info: "INFO",
    warn: "WARN",
    error: "ERR",
    success: "OK",
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#5865F2] flex items-center justify-center">
            <Icon name="Bot" size={18} className="text-white" />
          </div>
          <span className="font-semibold text-base tracking-tight">Bot Panel</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${botOnline ? "text-emerald-400" : "text-muted-foreground"}`}>
            <span className={`w-2 h-2 rounded-full ${botOnline ? "bg-emerald-400 animate-pulse-soft" : "bg-muted-foreground"}`} />
            {botOnline ? "Онлайн" : "Оффлайн"}
          </div>
          <button
            onClick={() => setDark(!dark)}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors"
          >
            <Icon name={dark ? "Sun" : "Moon"} size={15} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-56 border-r border-border p-3 flex flex-col gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-[#5865F2] text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Icon name={t.icon} size={16} />
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Dashboard */}
          {tab === "dashboard" && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h1 className="text-xl font-semibold">Панель управления</h1>
                <p className="text-sm text-muted-foreground mt-1">Управляй своим Discord ботом</p>
              </div>

              {/* Power Card */}
              <div className="border border-border rounded-xl p-6 flex items-center justify-between bg-card">
                <div>
                  <p className="font-medium">{botOnline ? "Бот работает" : "Бот выключен"}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {botOnline ? "Нажми чтобы выключить" : "Нажми чтобы включить"}
                  </p>
                </div>
                <button
                  onClick={toggleBot}
                  disabled={loading}
                  className={`w-14 h-14 rounded-full flex items-center justify-center font-medium transition-all active:scale-95 shadow-lg ${
                    botOnline
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                      : "bg-[#5865F2] hover:bg-[#4752C4] text-white"
                  } ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {loading ? (
                    <Icon name="Loader2" size={22} className="animate-spin" />
                  ) : (
                    <Icon name={botOnline ? "Power" : "PowerOff"} size={22} />
                  )}
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Команд", value: commands.length, icon: "Terminal" },
                  { label: "Активных", value: commands.filter((c) => c.enabled).length, icon: "CheckCircle" },
                  { label: "Событий", value: logs.length, icon: "Activity" },
                ].map((stat) => (
                  <div key={stat.label} className="border border-border rounded-xl p-4 bg-card">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Icon name={stat.icon} size={14} />
                      <span className="text-xs">{stat.label}</span>
                    </div>
                    <p className="text-2xl font-semibold">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Recent logs */}
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-sm font-medium">Последние события</span>
                  <button
                    onClick={() => setTab("logs")}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Все →
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {logs.slice(-3).map((log) => (
                    <div key={log.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                      <span className="text-xs text-muted-foreground font-mono w-16 shrink-0">{log.time}</span>
                      <span className={`text-xs font-mono font-semibold w-8 shrink-0 ${levelColor[log.level]}`}>
                        {levelLabel[log.level]}
                      </span>
                      <span className="text-sm">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Status */}
          {tab === "status" && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h1 className="text-xl font-semibold">Статус бота</h1>
                <p className="text-sm text-muted-foreground mt-1">Текущее состояние подключения</p>
              </div>
              <div className="border border-border rounded-xl p-6 bg-card space-y-5">
                {[
                  { label: "Состояние", value: botOnline ? "Онлайн" : "Оффлайн", ok: botOnline },
                  { label: "Discord API", value: "Подключено", ok: true },
                  { label: "Команды", value: `${commands.filter((c) => c.enabled).length} / ${commands.length} активны`, ok: true },
                  { label: "Хостинг", value: "Cloud Function", ok: true },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${row.ok ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                      <span className="text-sm font-medium">{row.value}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border border-border rounded-xl p-6 bg-card">
                <p className="text-sm font-medium mb-4">Быстрое управление</p>
                <div className="flex gap-3">
                  <button
                    onClick={toggleBot}
                    disabled={loading}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      botOnline
                        ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
                        : "bg-[#5865F2] text-white hover:bg-[#4752C4]"
                    } disabled:opacity-50`}
                  >
                    {loading ? "..." : botOnline ? "Выключить" : "Включить"}
                  </button>
                  <button
                    onClick={() => addLog("info", "Перезапуск бота...")}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-accent transition-colors"
                  >
                    Перезапустить
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Commands */}
          {tab === "commands" && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h1 className="text-xl font-semibold">Команды</h1>
                <p className="text-sm text-muted-foreground mt-1">Управляй командами бота</p>
              </div>
              <div className="space-y-3">
                {commands.map((cmd, i) => (
                  <div key={cmd.command} className="border border-border rounded-xl p-4 bg-card flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-lg bg-[#5865F2]/10 flex items-center justify-center">
                        <Icon name="Hash" size={16} className="text-[#5865F2]" />
                      </div>
                      <div>
                        <p className="font-mono font-semibold text-sm">{cmd.command}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cmd.description} → <span className="text-foreground">«{cmd.response}»</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={cmd.enabled ? "default" : "secondary"}
                        className={cmd.enabled ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : ""}
                      >
                        {cmd.enabled ? "Активна" : "Выкл"}
                      </Badge>
                      <Switch checked={cmd.enabled} onCheckedChange={() => toggleCommand(i)} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="border border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 text-center opacity-60">
                <Icon name="Plus" size={20} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Новые команды можно добавить позже</p>
              </div>
            </div>
          )}

          {/* Logs */}
          {tab === "logs" && (
            <div className="animate-fade-in h-full flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold">Логи</h1>
                  <p className="text-sm text-muted-foreground mt-1">История событий бота</p>
                </div>
                <button
                  onClick={() => setLogs([])}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors border border-border px-3 py-1.5 rounded-lg"
                >
                  Очистить
                </button>
              </div>
              <div className="flex-1 border border-border rounded-xl bg-card overflow-hidden">
                <div className="h-full overflow-auto p-4 space-y-1.5 font-mono text-xs min-h-64">
                  {logs.length === 0 && (
                    <p className="text-muted-foreground">Логи пусты</p>
                  )}
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-3 items-start">
                      <span className="text-muted-foreground w-16 shrink-0">{log.time}</span>
                      <span className={`${levelColor[log.level]} w-12 shrink-0`}>[{levelLabel[log.level]}]</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          )}

          {/* Settings */}
          {tab === "settings" && (
            <div className="animate-fade-in space-y-5">
              <div>
                <h1 className="text-xl font-semibold">Настройки</h1>
                <p className="text-sm text-muted-foreground mt-1">Подключи своего Discord бота</p>
              </div>

              {/* Текущий бот */}
              {savedInfo?.bot_token_set && (
                <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-4 flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse-soft shrink-0" />
                  <div>
                    <p className="text-sm font-medium">
                      {savedInfo.bot_name ? `Бот «${savedInfo.bot_name}» подключён` : "Бот подключён"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      App ID: {savedInfo.app_id} · Токен: {savedInfo.bot_token_preview}
                    </p>
                  </div>
                </div>
              )}

              {/* Форма — только токен */}
              <div className="border border-border rounded-xl bg-card p-5 space-y-4">
                <div>
                  <p className="text-sm font-medium">
                    {savedInfo?.bot_token_set ? "Сменить бота" : "Подключить бота"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Вставь Bot Token — всё остальное настроится автоматически
                  </p>
                </div>
                <input
                  type="password"
                  value={botToken}
                  onChange={e => { setBotToken(e.target.value); setSettingsError(""); }}
                  onKeyDown={e => e.key === "Enter" && saveSettings()}
                  placeholder="Вставь Bot Token сюда..."
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#5865F2]/40"
                />
                {settingsError && (
                  <p className="text-xs text-red-400">{settingsError}</p>
                )}
                <button
                  onClick={saveSettings}
                  disabled={settingsSaving || !botToken.trim()}
                  className="w-full py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium transition-all disabled:opacity-50"
                >
                  {settingsSaving ? "Подключаю..." : settingsSaved ? "✓ Подключено!" : "Подключить"}
                </button>
              </div>

              {/* Регистрация команд + Interactions URL */}
              {savedInfo?.bot_token_set && (
                <div className="border border-border rounded-xl bg-card p-5 space-y-4">
                  <div>
                    <p className="text-sm font-medium">Последний шаг</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Один раз укажи этот URL в Discord Developer Portal → Interactions Endpoint URL
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                    <code className="text-xs flex-1 truncate text-foreground">
                      https://functions.poehali.dev/a732a48b-2887-4612-a2e4-37497a35d07e
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText("https://functions.poehali.dev/a732a48b-2887-4612-a2e4-37497a35d07e")}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Icon name="Copy" size={14} />
                    </button>
                  </div>
                  <div className="border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground mb-3">После сохранения URL — зарегистрируй команды:</p>
                    <button
                      onClick={registerCommands}
                      disabled={registering}
                      className="w-full py-2.5 rounded-lg border border-border hover:bg-accent text-sm font-medium transition-all disabled:opacity-50"
                    >
                      {registering ? "Регистрирую..." : "Зарегистрировать /ku"}
                    </button>
                    {registerResult && (
                      <p className={`text-xs mt-2 ${registerResult.startsWith("✓") ? "text-emerald-500" : "text-red-400"}`}>
                        {registerResult}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Тема */}
              <div className="border border-border rounded-xl bg-card divide-y divide-border overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Тёмная тема</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Переключить тему оформления</p>
                  </div>
                  <Switch checked={dark} onCheckedChange={setDark} />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}