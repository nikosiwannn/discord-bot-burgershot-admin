"use client";

import { useState, useEffect, useCallback } from "react";

interface BotStatus {
  running: boolean;
  status: string;
  username?: string | null;
  guilds?: number;
}

interface GuildConfigData {
  id?: string;
  guildId: string;
  channelAwanseDegradyId: string;
  channelPlusyMinusyId: string;
  channelPochwayNaganyId: string;
  channelWypowiedzeniaId: string;
  rolePracownikBsId: string;
  roleZarzadId: string;
  roleManagerId: string;
  roleSupportId: string;
  rolePlus1Id: string;
  rolePlus2Id: string;
  rolePlus3Id: string;
  roleMinus1Id: string;
  roleMinus2Id: string;
  roleMinus3Id: string;
  rolePochwala1Id: string;
  rolePochwala2Id: string;
  roleNagana1Id: string;
  roleNagana2Id: string;
  plusesForCommendation: number;
  minusesForReprimand: number;
  taryfikatorUrl: string;
}

interface Position {
  id: number;
  guildId: string;
  name: string;
  roleId: string;
  level: number;
}

interface Employee {
  id: string;
  discordUserId: string;
  discordUsername: string;
  position: string;
  status: string;
  plusCount: number;
  minusCount: number;
  commendations: number;
  reprimands: number;
  hiredAt: string;
  firedAt: string | null;
}

interface HistoryEntry {
  id: number;
  employeeId: string;
  discordUserId: string;
  actionType: string;
  performedBy: string;
  performedByUsername: string;
  previousPosition: string | null;
  newPosition: string | null;
  reason: string | null;
  details: string | null;
  createdAt: string;
}

const DEFAULT_CONFIG: GuildConfigData = {
  guildId: "",
  channelAwanseDegradyId: "",
  channelPlusyMinusyId: "",
  channelPochwayNaganyId: "",
  channelWypowiedzeniaId: "",
  rolePracownikBsId: "",
  roleZarzadId: "",
  roleManagerId: "",
  roleSupportId: "",
  rolePlus1Id: "",
  rolePlus2Id: "",
  rolePlus3Id: "",
  roleMinus1Id: "",
  roleMinus2Id: "",
  roleMinus3Id: "",
  rolePochwala1Id: "",
  rolePochwala2Id: "",
  roleNagana1Id: "",
  roleNagana2Id: "",
  plusesForCommendation: 3,
  minusesForReprimand: 3,
  taryfikatorUrl: "",
};

type TabType = "bot" | "config" | "positions" | "employees" | "sql";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("bot");
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [token, setToken] = useState("");
  const [botMessage, setBotMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [guildId, setGuildId] = useState("");
  const [config, setConfig] = useState<GuildConfigData>(DEFAULT_CONFIG);
  const [configMessage, setConfigMessage] = useState("");

  const [positionsList, setPositionsList] = useState<Position[]>([]);
  const [newPosName, setNewPosName] = useState("");
  const [newPosRoleId, setNewPosRoleId] = useState("");
  const [newPosLevel, setNewPosLevel] = useState(1);

  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);

  // Fetch bot status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/bot");
      const data = await res.json();
      setBotStatus(data);
    } catch {
      setBotStatus({ running: false, status: "error" });
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Bot actions
  const handleBotAction = async (action: "start" | "stop") => {
    setLoading(true);
    setBotMessage("");
    try {
      const body: Record<string, string> = { action };
      if (action === "start") body.token = token;
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setBotMessage(data.message);
      fetchStatus();
    } catch (err) {
      setBotMessage("Błąd połączenia");
    }
    setLoading(false);
  };

  // Config
  const loadConfig = async () => {
    if (!guildId) return;
    try {
      const res = await fetch(`/api/config?guildId=${guildId}`);
      const data = await res.json();
      if (data.config) {
        setConfig({ ...DEFAULT_CONFIG, ...data.config });
      } else {
        setConfig({ ...DEFAULT_CONFIG, guildId });
      }
      setPositionsList(data.positions || []);
      setConfigMessage("✅ Konfiguracja załadowana");
    } catch {
      setConfigMessage("❌ Błąd ładowania");
    }
  };

  const saveConfig = async () => {
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, guildId }),
      });
      const data = await res.json();
      setConfigMessage(data.success ? "✅ Zapisano!" : `❌ ${data.error}`);
    } catch {
      setConfigMessage("❌ Błąd zapisu");
    }
  };

  // Positions
  const loadPositions = async () => {
    if (!guildId) return;
    try {
      const res = await fetch(`/api/positions?guildId=${guildId}`);
      const data = await res.json();
      setPositionsList(data.positions || []);
    } catch {
      /* ignore */
    }
  };

  const addPosition = async () => {
    if (!guildId || !newPosName || !newPosRoleId) return;
    try {
      await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          name: newPosName,
          roleId: newPosRoleId,
          level: newPosLevel,
        }),
      });
      setNewPosName("");
      setNewPosRoleId("");
      setNewPosLevel((positionsList.length || 0) + 1);
      loadPositions();
    } catch {
      /* ignore */
    }
  };

  const deletePosition = async (id: number) => {
    try {
      await fetch(`/api/positions?id=${id}&guildId=${guildId}`, { method: "DELETE" });
      loadPositions();
    } catch {
      /* ignore */
    }
  };

  // Employees
  const loadEmployees = async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      setEmployeesList(data.employees || []);
      setHistoryList(data.history || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (activeTab === "employees") loadEmployees();
  }, [activeTab]);

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "bot", label: "Bot", icon: "🤖" },
    { id: "config", label: "Konfiguracja", icon: "⚙️" },
    { id: "positions", label: "Stanowiska", icon: "📋" },
    { id: "employees", label: "Pracownicy", icon: "👥" },
    { id: "sql", label: "SQL Export", icon: "📄" },
  ];

  const actionLabels: Record<string, string> = {
    hire: "📥 Zatrudnienie",
    fire: "❌ Zwolnienie",
    promote: "📈 Awans",
    demote: "📉 Degradacja",
    plus: "➕ Plus",
    minus: "➖ Minus",
    commendation: "🏆 Pochwała",
    reprimand: "⚠️ Nagana",
    auto_promote: "🚀 Auto-awans",
    resignation: "📝 Wypowiedzenie",
    commendation_reset: "🏆 Reset pochwał",
    reprimand_reset: "⚠️ Reset nagan",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <header className="border-b border-orange-900/30 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🍔</span>
            <div>
              <h1 className="text-2xl font-bold text-orange-400">BurgerShot Manager Bot</h1>
              <p className="text-sm text-gray-400">Panel konfiguracyjny</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                botStatus?.running ? "bg-green-400 animate-pulse" : "bg-red-400"
              }`}
            />
            <span className="text-sm text-gray-400">
              {botStatus?.running ? botStatus.username || "Online" : "Offline"}
            </span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="flex gap-1 bg-gray-900/50 rounded-xl p-1 border border-gray-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
                activeTab === tab.id
                  ? "bg-orange-600 text-white shadow-lg shadow-orange-600/25"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 mt-6 pb-12">
        {/* BOT TAB */}
        {activeTab === "bot" && (
          <div className="space-y-6">
            {/* Status */}
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
              <h2 className="text-xl font-bold text-orange-400 mb-4">📡 Status Bota</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <p className="text-sm text-gray-400">Status</p>
                  <p className="text-lg font-bold">
                    {botStatus?.running ? (
                      <span className="text-green-400">✅ Online</span>
                    ) : (
                      <span className="text-red-400">❌ Offline</span>
                    )}
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <p className="text-sm text-gray-400">Użytkownik</p>
                  <p className="text-lg font-bold">{botStatus?.username || "—"}</p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <p className="text-sm text-gray-400">Serwery</p>
                  <p className="text-lg font-bold">{botStatus?.guilds ?? 0}</p>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
              <h2 className="text-xl font-bold text-orange-400 mb-4">🎮 Kontrola Bota</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Token Discord Bota</label>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Wklej token bota..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleBotAction("start")}
                    disabled={loading}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? "⏳ Ładowanie..." : "▶️ Uruchom Bota"}
                  </button>
                  <button
                    onClick={() => handleBotAction("stop")}
                    disabled={loading}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    ⏹️ Zatrzymaj
                  </button>
                </div>
                {botMessage && (
                  <div
                    className={`p-4 rounded-lg ${
                      botMessage.includes("❌")
                        ? "bg-red-900/30 border border-red-800 text-red-300"
                        : "bg-green-900/30 border border-green-800 text-green-300"
                    }`}
                  >
                    {botMessage}
                  </div>
                )}
              </div>
            </div>

            {/* Commands info */}
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
              <h2 className="text-xl font-bold text-orange-400 mb-4">📋 Komendy Bota</h2>
              
              {/* Zarządzanie pracownikami */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">👥 Zarządzanie Pracownikami</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { cmd: "/zatrudnij", icon: "📥", desc: "Zatrudnij nowego pracownika", params: "@użytkownik, stanowisko", perm: "Manager+" },
                    { cmd: "/awans", icon: "📈", desc: "Daj awans pracownikowi", params: "@użytkownik", perm: "Manager+" },
                    { cmd: "/degraduj", icon: "📉", desc: "Degraduj pracownika", params: "@użytkownik, powód", perm: "Manager+" },
                    { cmd: "/zwolnij", icon: "❌", desc: "Zwolnij pracownika", params: "@użytkownik, powód", perm: "Manager+" },
                    { cmd: "/wypowiedzenie", icon: "📝", desc: "Wypowiedzenie / zwolnienie z archiwizacją", params: "@kto, powód", perm: "Manager+" },
                  ].map((c) => (
                    <div key={c.cmd} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{c.icon}</span>
                        <code className="text-orange-400 font-mono font-bold">{c.cmd}</code>
                      </div>
                      <p className="text-sm text-gray-300">{c.desc}</p>
                      <p className="text-xs text-gray-500 mt-1">Parametry: {c.params}</p>
                      <span className="inline-block mt-2 text-xs bg-orange-900/30 text-orange-300 px-2 py-0.5 rounded">{c.perm}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* System ocen */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">⭐ System Ocen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { cmd: "/plus", icon: "➕", desc: "Przyznaj plus pracownikowi (3 plusy = pochwała)", params: "@użytkownik, powód", perm: "Support+" },
                    { cmd: "/minus", icon: "➖", desc: "Przyznaj minus pracownikowi (3 minusy = nagana)", params: "@użytkownik, powód", perm: "Support+" },
                  ].map((c) => (
                    <div key={c.cmd} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{c.icon}</span>
                        <code className="text-orange-400 font-mono font-bold">{c.cmd}</code>
                      </div>
                      <p className="text-sm text-gray-300">{c.desc}</p>
                      <p className="text-xs text-gray-500 mt-1">Parametry: {c.params}</p>
                      <span className="inline-block mt-2 text-xs bg-green-900/30 text-green-300 px-2 py-0.5 rounded">{c.perm}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Informacje */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">📊 Informacje</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { cmd: "/karta", icon: "📄", desc: "Pełna karta pracownika z historią", params: "@użytkownik", perm: "Support+" },
                    { cmd: "/pracownik", icon: "🔍", desc: "Szybkie info o pracowniku", params: "@użytkownik", perm: "Support+" },
                    { cmd: "/statystyki", icon: "📊", desc: "Statystyki Burger Shot", params: "brak", perm: "Support+" },
                    { cmd: "/ranking", icon: "🏆", desc: "Ranking pracowników", params: "brak", perm: "Support+" },
                  ].map((c) => (
                    <div key={c.cmd} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{c.icon}</span>
                        <code className="text-orange-400 font-mono font-bold">{c.cmd}</code>
                      </div>
                      <p className="text-sm text-gray-300">{c.desc}</p>
                      <p className="text-xs text-gray-500 mt-1">Parametry: {c.params}</p>
                      <span className="inline-block mt-2 text-xs bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded">{c.perm}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* System rang info */}
              <div className="mt-6 p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
                <h3 className="text-sm font-semibold text-orange-300 mb-3">⭐ System Rang Plusów/Minusów</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-green-400 font-semibold mb-2">Plusy → Pochwały → Awans</p>
                    <ul className="text-gray-400 space-y-1">
                      <li>⭐ 1/3 — 1 plus</li>
                      <li>⭐⭐ 2/3 — 2 plusy</li>
                      <li>⭐⭐⭐ 3/3 → 🏆 1/2 Pochwała (reset plusów)</li>
                      <li>🏆 2/2 Pochwały → 🚀 Automatyczny awans!</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-red-400 font-semibold mb-2">Minusy → Nagany → Alert</p>
                    <ul className="text-gray-400 space-y-1">
                      <li>❌ 1/3 — 1 minus</li>
                      <li>❌❌ 2/3 — 2 minusy</li>
                      <li>❌❌❌ 3/3 → ⚠️ 1/2 Nagana (reset minusów)</li>
                      <li>⚠️ 2/2 Nagany → 🚨 Powiadomienie zarządu</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONFIG TAB */}
        {activeTab === "config" && (
          <div className="space-y-6">
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
              <h2 className="text-xl font-bold text-orange-400 mb-4">⚙️ Konfiguracja Serwera</h2>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">ID Serwera (Guild ID)</label>
                <div className="flex gap-2">
                  <input
                    value={guildId}
                    onChange={(e) => {
                      setGuildId(e.target.value);
                      setConfig((c) => ({ ...c, guildId: e.target.value }));
                    }}
                    placeholder="np. 1234567890"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={loadConfig}
                    className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
                  >
                    📥 Załaduj
                  </button>
                </div>
              </div>

              {configMessage && (
                <div
                  className={`p-3 rounded-lg mb-4 ${
                    configMessage.includes("❌")
                      ? "bg-red-900/30 border border-red-800 text-red-300"
                      : "bg-green-900/30 border border-green-800 text-green-300"
                  }`}
                >
                  {configMessage}
                </div>
              )}

              {guildId && (
                <div className="space-y-6">
                  {/* Channels */}
                  <div>
                    <h3 className="text-lg font-semibold text-orange-300 mb-3">📗 Kanały</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { key: "channelAwanseDegradyId" as const, label: "#awanse-degrady" },
                        { key: "channelPlusyMinusyId" as const, label: "#plusy-minusy" },
                        { key: "channelPochwayNaganyId" as const, label: "#pochwały-nagany" },
                        { key: "channelWypowiedzeniaId" as const, label: "#wypowiedzenia-zwolnienia" },
                      ].map((ch) => (
                        <div key={ch.key}>
                          <label className="block text-sm text-gray-400 mb-1">{ch.label}</label>
                          <input
                            value={config[ch.key] || ""}
                            onChange={(e) => setConfig((c) => ({ ...c, [ch.key]: e.target.value }))}
                            placeholder="ID kanału"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Main roles */}
                  <div>
                    <h3 className="text-lg font-semibold text-orange-300 mb-3">🛡️ Role Uprawnień</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { key: "rolePracownikBsId" as const, label: "Pracownik BS" },
                        { key: "roleZarzadId" as const, label: "Zarząd" },
                        { key: "roleManagerId" as const, label: "Manager" },
                        { key: "roleSupportId" as const, label: "Support" },
                      ].map((r) => (
                        <div key={r.key}>
                          <label className="block text-sm text-gray-400 mb-1">{r.label}</label>
                          <input
                            value={config[r.key] || ""}
                            onChange={(e) => setConfig((c) => ({ ...c, [r.key]: e.target.value }))}
                            placeholder="ID roli"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Plus roles */}
                  <div>
                    <h3 className="text-lg font-semibold text-orange-300 mb-3">⭐ Role Plusów</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { key: "rolePlus1Id" as const, label: "⭐ 1/3" },
                        { key: "rolePlus2Id" as const, label: "⭐⭐ 2/3" },
                        { key: "rolePlus3Id" as const, label: "⭐⭐⭐ 3/3" },
                      ].map((r) => (
                        <div key={r.key}>
                          <label className="block text-sm text-gray-400 mb-1">{r.label}</label>
                          <input
                            value={config[r.key] || ""}
                            onChange={(e) => setConfig((c) => ({ ...c, [r.key]: e.target.value }))}
                            placeholder="ID roli"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Commendation roles */}
                  <div>
                    <h3 className="text-lg font-semibold text-orange-300 mb-3">🏆 Role Pochwał</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { key: "rolePochwala1Id" as const, label: "🏆 1/2 Pochwała" },
                        { key: "rolePochwala2Id" as const, label: "🏆 2/2 Pochwały" },
                      ].map((r) => (
                        <div key={r.key}>
                          <label className="block text-sm text-gray-400 mb-1">{r.label}</label>
                          <input
                            value={config[r.key] || ""}
                            onChange={(e) => setConfig((c) => ({ ...c, [r.key]: e.target.value }))}
                            placeholder="ID roli"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Minus roles */}
                  <div>
                    <h3 className="text-lg font-semibold text-orange-300 mb-3">❌ Role Minusów</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { key: "roleMinus1Id" as const, label: "❌ 1/3" },
                        { key: "roleMinus2Id" as const, label: "❌❌ 2/3" },
                        { key: "roleMinus3Id" as const, label: "❌❌❌ 3/3" },
                      ].map((r) => (
                        <div key={r.key}>
                          <label className="block text-sm text-gray-400 mb-1">{r.label}</label>
                          <input
                            value={config[r.key] || ""}
                            onChange={(e) => setConfig((c) => ({ ...c, [r.key]: e.target.value }))}
                            placeholder="ID roli"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reprimand roles */}
                  <div>
                    <h3 className="text-lg font-semibold text-orange-300 mb-3">⚠️ Role Nagan</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { key: "roleNagana1Id" as const, label: "⚠️ 1/2 Nagana" },
                        { key: "roleNagana2Id" as const, label: "⚠️ 2/2 Nagany" },
                      ].map((r) => (
                        <div key={r.key}>
                          <label className="block text-sm text-gray-400 mb-1">{r.label}</label>
                          <input
                            value={config[r.key] || ""}
                            onChange={(e) => setConfig((c) => ({ ...c, [r.key]: e.target.value }))}
                            placeholder="ID roli"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Settings */}
                  <div>
                    <h3 className="text-lg font-semibold text-orange-300 mb-3">🔧 Ustawienia</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Plusy do pochwały
                        </label>
                        <input
                          type="number"
                          value={config.plusesForCommendation}
                          onChange={(e) =>
                            setConfig((c) => ({
                              ...c,
                              plusesForCommendation: parseInt(e.target.value) || 3,
                            }))
                          }
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Minusy do nagany
                        </label>
                        <input
                          type="number"
                          value={config.minusesForReprimand}
                          onChange={(e) =>
                            setConfig((c) => ({
                              ...c,
                              minusesForReprimand: parseInt(e.target.value) || 3,
                            }))
                          }
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          URL taryfikatora (grafika)
                        </label>
                        <input
                          value={config.taryfikatorUrl}
                          onChange={(e) =>
                            setConfig((c) => ({ ...c, taryfikatorUrl: e.target.value }))
                          }
                          placeholder="https://..."
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={saveConfig}
                    className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-lg transition-colors"
                  >
                    💾 Zapisz Konfigurację
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* POSITIONS TAB */}
        {activeTab === "positions" && (
          <div className="space-y-6">
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
              <h2 className="text-xl font-bold text-orange-400 mb-4">
                📋 Stanowiska (Hierarchia)
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Dodaj stanowiska od najniższego (level 1) do najwyższego. Bot automatycznie
                awansuje/degraduje na podstawie tej hierarchii.
              </p>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">ID Serwera</label>
                <div className="flex gap-2">
                  <input
                    value={guildId}
                    onChange={(e) => setGuildId(e.target.value)}
                    placeholder="Guild ID"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={loadPositions}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                  >
                    📥 Załaduj
                  </button>
                </div>
              </div>

              {/* Existing positions */}
              {positionsList.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">
                    Aktualna hierarchia:
                  </h3>
                  <div className="space-y-2">
                    {positionsList.map((pos) => (
                      <div
                        key={pos.id}
                        className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3"
                      >
                        <div>
                          <span className="text-orange-400 font-mono mr-2">Lv.{pos.level}</span>
                          <span className="text-white font-medium">{pos.name}</span>
                          <span className="text-gray-500 text-sm ml-2">(Role: {pos.roleId})</span>
                        </div>
                        <button
                          onClick={() => deletePosition(pos.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          🗑️ Usuń
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add position */}
              {guildId && (
                <div className="border-t border-gray-800 pt-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">
                    Dodaj stanowisko:
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nazwa</label>
                      <input
                        value={newPosName}
                        onChange={(e) => setNewPosName(e.target.value)}
                        placeholder="np. Nowy"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">ID Roli Discord</label>
                      <input
                        value={newPosRoleId}
                        onChange={(e) => setNewPosRoleId(e.target.value)}
                        placeholder="np. 123456789"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Level</label>
                      <input
                        type="number"
                        value={newPosLevel}
                        onChange={(e) => setNewPosLevel(parseInt(e.target.value) || 1)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={addPosition}
                        className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                      >
                        ➕ Dodaj
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* EMPLOYEES TAB */}
        {activeTab === "employees" && (
          <div className="space-y-6">
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-orange-400">👥 Pracownicy</h2>
                <button
                  onClick={loadEmployees}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm transition-colors"
                >
                  🔄 Odśwież
                </button>
              </div>

              {employeesList.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Brak pracowników w bazie danych
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-2 px-3 text-gray-400">Użytkownik</th>
                        <th className="text-left py-2 px-3 text-gray-400">Stanowisko</th>
                        <th className="text-left py-2 px-3 text-gray-400">Status</th>
                        <th className="text-left py-2 px-3 text-gray-400">Plusy</th>
                        <th className="text-left py-2 px-3 text-gray-400">Minusy</th>
                        <th className="text-left py-2 px-3 text-gray-400">Pochwały</th>
                        <th className="text-left py-2 px-3 text-gray-400">Nagany</th>
                        <th className="text-left py-2 px-3 text-gray-400">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeesList.map((emp) => (
                        <tr key={emp.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-2 px-3 text-white">{emp.discordUsername}</td>
                          <td className="py-2 px-3 text-orange-300">{emp.position}</td>
                          <td className="py-2 px-3">
                            {emp.status === "active" ? (
                              <span className="text-green-400">✅ Aktywny</span>
                            ) : (
                              <span className="text-red-400">❌ {emp.status}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-green-300">{emp.plusCount}</td>
                          <td className="py-2 px-3 text-red-300">{emp.minusCount}</td>
                          <td className="py-2 px-3 text-yellow-300">{emp.commendations}/2</td>
                          <td className="py-2 px-3 text-orange-300">{emp.reprimands}/2</td>
                          <td className="py-2 px-3 text-gray-400 text-xs">
                            {new Date(emp.hiredAt).toLocaleDateString("pl-PL")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent History */}
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
              <h2 className="text-xl font-bold text-orange-400 mb-4">📜 Ostatnia Historia</h2>
              {historyList.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Brak wpisów</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {historyList.slice(0, 50).map((h) => (
                    <div
                      key={h.id}
                      className="flex items-start gap-3 bg-gray-800/30 rounded-lg p-3"
                    >
                      <span className="text-lg">
                        {actionLabels[h.actionType]?.split(" ")[0] || "📌"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">
                          <span className="text-gray-400">
                            {actionLabels[h.actionType]?.split(" ").slice(1).join(" ") ||
                              h.actionType}
                          </span>
                          {h.reason && (
                            <span className="text-gray-500"> — {h.reason}</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {h.performedByUsername !== "SYSTEM"
                            ? `przez ${h.performedByUsername}`
                            : "automatycznie"}{" "}
                          • {new Date(h.createdAt).toLocaleString("pl-PL")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SQL EXPORT TAB */}
        {activeTab === "sql" && (
          <div className="space-y-6">
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
              <h2 className="text-xl font-bold text-orange-400 mb-4">
                📄 SQL Export (dla Neon.tech)
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Skopiuj poniższe zapytania SQL i wklej je w konsoli SQL na Neon.tech aby
                stworzyć bazę danych.
              </p>
              <div className="relative">
                <button
                  onClick={() => {
                    const el = document.getElementById("sql-export") as HTMLTextAreaElement;
                    if (el) {
                      el.select();
                      navigator.clipboard.writeText(el.value);
                    }
                  }}
                  className="absolute top-2 right-2 px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm transition-colors z-10"
                >
                  📋 Kopiuj
                </button>
                <textarea
                  id="sql-export"
                  readOnly
                  rows={35}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg p-4 text-green-400 font-mono text-xs focus:outline-none"
                  value={`-- ============================================================
-- BurgerShot Manager Bot - Database Setup Script
-- Uruchom to na PostgreSQL (Neon.tech) aby stworzyć tabele
-- ============================================================

-- ==================== CREATE ENUMS ====================
DO $$ BEGIN
  CREATE TYPE employee_status AS ENUM ('active', 'fired', 'resigned');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE action_type AS ENUM (
    'hire', 'fire', 'promote', 'demote',
    'plus', 'minus', 'commendation', 'reprimand',
    'auto_promote', 'resignation', 'commendation_reset', 'reprimand_reset'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==================== CREATE TABLES ====================

-- Pracownicy
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL,
  discord_username TEXT NOT NULL,
  position TEXT NOT NULL,
  status employee_status NOT NULL DEFAULT 'active',
  plus_count INTEGER NOT NULL DEFAULT 0,
  minus_count INTEGER NOT NULL DEFAULT 0,
  commendations INTEGER NOT NULL DEFAULT 0,
  reprimands INTEGER NOT NULL DEFAULT 0,
  hired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hired_by TEXT NOT NULL,
  fired_at TIMESTAMPTZ,
  fired_by TEXT,
  fire_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historia akcji
CREATE TABLE IF NOT EXISTS action_history (
  id SERIAL PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id),
  discord_user_id TEXT NOT NULL,
  action_type action_type NOT NULL,
  performed_by TEXT NOT NULL,
  performed_by_username TEXT NOT NULL,
  previous_position TEXT,
  new_position TEXT,
  reason TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Konfiguracja serwera Discord
CREATE TABLE IF NOT EXISTS guild_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL UNIQUE,
  -- Kanały
  channel_awanse_degrady_id TEXT,
  channel_plusy_minusy_id TEXT,
  channel_pochwaly_nagany_id TEXT,
  channel_wypowiedzenia_id TEXT,
  -- Role główne
  role_pracownik_bs_id TEXT,
  role_zarzad_id TEXT,
  role_manager_id TEXT,
  role_support_id TEXT,
  -- Role plusów
  role_plus_1_id TEXT,
  role_plus_2_id TEXT,
  role_plus_3_id TEXT,
  -- Role pochwał
  role_pochwala_1_id TEXT,
  role_pochwala_2_id TEXT,
  -- Role nagan
  role_nagana_1_id TEXT,
  role_nagana_2_id TEXT,
  -- Role minusów
  role_minus_1_id TEXT,
  role_minus_2_id TEXT,
  role_minus_3_id TEXT,
  -- Ustawienia
  pluses_for_commendation INTEGER NOT NULL DEFAULT 3,
  minuses_for_reprimand INTEGER NOT NULL DEFAULT 3,
  taryfikator_url TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stanowiska (hierarchia)
CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_employees_discord_user_id ON employees(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_action_history_employee_id ON action_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_action_history_discord_user_id ON action_history(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_positions_guild_id ON positions(guild_id);

-- ==================== DONE ====================
-- Tabele utworzone! Teraz skonfiguruj bota przez panel webowy.
`}
                />
              </div>
            </div>

            {/* Render.com deployment info */}
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
              <h2 className="text-xl font-bold text-orange-400 mb-4">
                🚀 Deployment na Render.com
              </h2>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">1. Zmienne środowiskowe</h3>
                  <code className="text-green-400 block">DATABASE_URL=postgresql://user:pass@host/dbname</code>
                  <code className="text-green-400 block mt-1">DISCORD_TOKEN=twoj_token_bota</code>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">2. Build Command</h3>
                  <code className="text-green-400">npm install && npm run build</code>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">3. Start Command</h3>
                  <code className="text-green-400">npm start</code>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">4. Discord Developer Portal</h3>
                  <p>Włącz w ustawieniach bota:</p>
                  <ul className="list-disc list-inside mt-1 text-gray-400">
                    <li>Server Members Intent ✅</li>
                    <li>Message Content Intent ✅</li>
                    <li>Presence Intent ✅</li>
                  </ul>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">5. Uprawnienia bota</h3>
                  <p>Bot potrzebuje uprawnień:</p>
                  <ul className="list-disc list-inside mt-1 text-gray-400">
                    <li>Manage Roles</li>
                    <li>Send Messages</li>
                    <li>Use Slash Commands</li>
                    <li>Embed Links</li>
                    <li>Read Message History</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
