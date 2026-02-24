import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const BOTS_API = "https://functions.poehali.dev/e11f756f-1620-4383-897b-d2810661c365";
const INTERACTIONS_URL = "https://functions.poehali.dev/a732a48b-2887-4612-a2e4-37497a35d07e";

type Tab = "dashboard" | "bots" | "commands" | "logs" | "settings";

interface LogEntry {
  id: number;
  time: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

interface Bot {
  id: number;
  name: string;
  app_id: string;
  is_active: boolean;
  created_at: string;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Панель", icon: "LayoutDashboard" },
  { id: "bots", label: "Боты", icon: "Bot" },
  { id: "commands", label: "Команды", icon: "Terminal" },
  { id: "logs", label: "Логи", icon: "ScrollText" },
  { id: "settings", label: "Настройки", icon: "Settings" },
];

const COMMANDS_LIST = [
  { command: "/ku", description: "Приветствие", response: "Привет!", enabled: true },
];

const INITIAL_LOGS: LogEntry[] = [
  { id: 1, time: "00:00:00", level: "info", message: "Панель управления загружена" },
];

export default function Index() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dark, setDark] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(INITIAL_LOGS.length + 1);

  // Боты
  const [bots, setBots] = useState<Bot[]>([]);
  const [botsLoading, setBotsLoading] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [addingBot, setAddingBot] = useState(false);
  const [addError, setAddError] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Команды
  const [commands, setCommands] = useState(COMMANDS_LIST);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = useCallback((level: LogEntry["level"], message: string) => {
    const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs(prev => [...prev, { id: logIdRef.current++, time, level, message }]);
  }, []);

  const loadBots = useCallback(async () => {
    setBotsLoading(true);
    try {
      const data = await fetch(BOTS_API).then(r => r.json());
      setBots(data.bots || []);
    } catch {
      addLog("error", "Не удалось загрузить список ботов");
    }
    setBotsLoading(false);
  }, [addLog]);

  useEffect(() => { loadBots(); }, [loadBots]);

  const activeBot = bots.find(b => b.is_active) ?? null;

  const addBot = async () => {
    if (!newToken.trim()) return;
    setAddingBot(true);
    setAddError("");
    try {
      const res = await fetch(BOTS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: newToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAddError(data.error || "Неверный токен");
      } else {
        setNewToken("");
        addLog("success", `Бот «${data.bot.name}» добавлен и команды зарегистрированы`);
        await loadBots();
      }
    } catch {
      setAddError("Ошибка подключения");
    }
    setAddingBot(false);
  };

  const toggleBot = async (bot: Bot) => {
    setTogglingId(bot.id);
    const endpoint = bot.is_active ? "/deactivate" : "/activate";
    try {
      await fetch(BOTS_API + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bot.id }),
      });
      addLog(bot.is_active ? "warn" : "success", `Бот «${bot.name}» ${bot.is_active ? "остановлен" : "запущен"}`);
      await loadBots();
    } catch {
      addLog("error", "Ошибка переключения бота");
    }
    setTogglingId(null);
  };

  const deleteBot = async (bot: Bot) => {
    setDeletingId(bot.id);
    try {
      await fetch(BOTS_API + "/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bot.id }),
      });
      addLog("warn", `Бот «${bot.name}» удалён`);
      await loadBots();
    } catch {
      addLog("error", "Ошибка удаления бота");
    }
    setDeletingId(null);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(INTERACTIONS_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleCommand = (i: number) => {
    const cmd = commands[i];
    setCommands(prev => prev.map((c, idx) => idx === i ? { ...c, enabled: !c.enabled } : c));
    addLog(!cmd.enabled ? "success" : "warn", `Команда ${cmd.command} ${!cmd.enabled ? "включена" : "выключена"}`);
  };

  const levelColor: Record<LogEntry["level"], string> = {
    info: "text-blue-400", warn: "text-yellow-400", error: "text-red-400", success: "text-emerald-400",
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
          <div className={`flex items-center gap-1.5 text-xs font-medium ${activeBot ? "text-emerald-400" : "text-muted-foreground"}`}>
            <span className={`w-2 h-2 rounded-full ${activeBot ? "bg-emerald-400 animate-pulse-soft" : "bg-muted-foreground"}`} />
            {activeBot ? activeBot.name : "Нет активного бота"}
          </div>
          <button onClick={() => setDark(!dark)} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors">
            <Icon name={dark ? "Sun" : "Moon"} size={15} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-56 border-r border-border p-3 flex flex-col gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? "bg-[#5865F2] text-white" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Icon name={t.icon} size={16} />
              {t.label}
              {t.id === "bots" && bots.length > 0 && (
                <span className="ml-auto text-xs bg-muted rounded-full px-1.5 py-0.5">{bots.length}</span>
              )}
            </button>
          ))}
        </nav>

        <main className="flex-1 p-6 overflow-auto">

          {/* Dashboard */}
          {tab === "dashboard" && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h1 className="text-xl font-semibold">Панель управления</h1>
                <p className="text-sm text-muted-foreground mt-1">Обзор Discord ботов</p>
              </div>

              {/* Активный бот */}
              {activeBot ? (
                <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center">
                      <Icon name="Bot" size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">{activeBot.name}</p>
                      <p className="text-xs text-muted-foreground">App ID: {activeBot.app_id}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleBot(activeBot)}
                    disabled={togglingId === activeBot.id}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 transition-all disabled:opacity-50"
                  >
                    {togglingId === activeBot.id ? "..." : "Остановить"}
                  </button>
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-xl p-6 text-center space-y-2">
                  <Icon name="BotOff" size={28} className="text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium">Нет активного бота</p>
                  <p className="text-xs text-muted-foreground">Добавь бота во вкладке «Боты»</p>
                  <button onClick={() => setTab("bots")} className="mt-2 px-4 py-2 rounded-lg bg-[#5865F2] text-white text-sm hover:bg-[#4752C4] transition-colors">
                    Добавить бота
                  </button>
                </div>
              )}

              {/* Статистика */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Всего ботов", value: bots.length, icon: "Bot" },
                  { label: "Команд", value: commands.filter(c => c.enabled).length, icon: "Terminal" },
                  { label: "Событий", value: logs.length, icon: "Activity" },
                ].map(stat => (
                  <div key={stat.label} className="border border-border rounded-xl p-4 bg-card">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Icon name={stat.icon} size={14} />
                      <span className="text-xs">{stat.label}</span>
                    </div>
                    <p className="text-2xl font-semibold">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Последние события */}
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-sm font-medium">Последние события</span>
                  <button onClick={() => setTab("logs")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Все →</button>
                </div>
                <div className="divide-y divide-border">
                  {logs.slice(-3).map(log => (
                    <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono w-16 shrink-0">{log.time}</span>
                      <span className={`text-xs font-mono font-semibold w-10 shrink-0 ${levelColor[log.level]}`}>[{log.level.toUpperCase().slice(0,2)}]</span>
                      <span className="text-sm">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Боты */}
          {tab === "bots" && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h1 className="text-xl font-semibold">Боты</h1>
                <p className="text-sm text-muted-foreground mt-1">Управляй своими Discord ботами</p>
              </div>

              {/* Добавить бота */}
              <div className="border border-border rounded-xl bg-card p-5 space-y-4">
                <div>
                  <p className="text-sm font-medium">Добавить бота</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Вставь Bot Token — всё остальное настроится автоматически</p>
                </div>
                <input
                  type="password"
                  value={newToken}
                  onChange={e => { setNewToken(e.target.value); setAddError(""); }}
                  onKeyDown={e => e.key === "Enter" && addBot()}
                  placeholder="Вставь Bot Token..."
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#5865F2]/40"
                />
                {addError && <p className="text-xs text-red-400">{addError}</p>}
                <button
                  onClick={addBot}
                  disabled={addingBot || !newToken.trim()}
                  className="w-full py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium transition-all disabled:opacity-50"
                >
                  {addingBot ? "Подключаю..." : "Добавить и запустить"}
                </button>
              </div>

              {/* Список ботов */}
              {botsLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Icon name="Loader2" size={20} className="animate-spin mr-2" /> Загружаю...
                </div>
              ) : bots.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">Ботов пока нет</div>
              ) : (
                <div className="space-y-3">
                  {bots.map(bot => (
                    <div key={bot.id} className={`border rounded-xl p-4 bg-card flex items-center justify-between transition-all ${bot.is_active ? "border-emerald-500/30" : "border-border"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${bot.is_active ? "bg-emerald-500" : "bg-muted"}`}>
                          <Icon name="Bot" size={16} className={bot.is_active ? "text-white" : "text-muted-foreground"} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{bot.name}</p>
                            {bot.is_active && <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs">Активен</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">App ID: {bot.app_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleBot(bot)}
                          disabled={togglingId === bot.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                            bot.is_active
                              ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
                              : "bg-[#5865F2] text-white hover:bg-[#4752C4]"
                          }`}
                        >
                          {togglingId === bot.id ? "..." : bot.is_active ? "Стоп" : "Запустить"}
                        </button>
                        <button
                          onClick={() => deleteBot(bot)}
                          disabled={deletingId === bot.id}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-50"
                        >
                          <Icon name="Trash2" size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Interactions URL */}
              <div className="border border-border rounded-xl bg-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Interactions Endpoint URL (вставь в Discord Developer Portal)</p>
                <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                  <code className="text-xs flex-1 truncate">{INTERACTIONS_URL}</code>
                  <button onClick={copyUrl} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                    <Icon name={copied ? "Check" : "Copy"} size={13} className={copied ? "text-emerald-400" : ""} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Команды */}
          {tab === "commands" && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h1 className="text-xl font-semibold">Команды</h1>
                <p className="text-sm text-muted-foreground mt-1">Slash-команды активного бота</p>
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
                      <Badge variant={cmd.enabled ? "default" : "secondary"} className={cmd.enabled ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : ""}>
                        {cmd.enabled ? "Активна" : "Выкл"}
                      </Badge>
                      <Switch checked={cmd.enabled} onCheckedChange={() => toggleCommand(i)} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="border border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 text-center opacity-60">
                <Icon name="Plus" size={20} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Новые команды добавляются через чат с разработчиком</p>
              </div>
            </div>
          )}

          {/* Логи */}
          {tab === "logs" && (
            <div className="animate-fade-in h-full flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold">Логи</h1>
                  <p className="text-sm text-muted-foreground mt-1">История событий</p>
                </div>
                <button onClick={() => setLogs([])} className="text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg transition-colors">
                  Очистить
                </button>
              </div>
              <div className="flex-1 border border-border rounded-xl bg-card overflow-hidden">
                <div className="h-full overflow-auto p-4 space-y-1.5 font-mono text-xs min-h-64">
                  {logs.length === 0 && <p className="text-muted-foreground">Логи пусты</p>}
                  {logs.map(log => (
                    <div key={log.id} className="flex gap-3 items-start">
                      <span className="text-muted-foreground w-16 shrink-0">{log.time}</span>
                      <span className={`${levelColor[log.level]} w-14 shrink-0`}>[{log.level.toUpperCase()}]</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          )}

          {/* Настройки */}
          {tab === "settings" && (
            <div className="animate-fade-in space-y-5">
              <div>
                <h1 className="text-xl font-semibold">Настройки</h1>
                <p className="text-sm text-muted-foreground mt-1">Внешний вид и прочее</p>
              </div>
              <div className="border border-border rounded-xl bg-card divide-y divide-border overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Тёмная тема</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Переключить тему оформления</p>
                  </div>
                  <Switch checked={dark} onCheckedChange={setDark} />
                </div>
              </div>
              <div className="border border-border rounded-xl bg-card p-5 space-y-2">
                <p className="text-sm font-medium">Информация</p>
                <div className="space-y-2 text-sm">
                  {[
                    { label: "Платформа", value: "Discord" },
                    { label: "Хостинг", value: "Cloud Function" },
                    { label: "Версия", value: "2.0.0" },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between">
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className="font-medium">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
