"use client";

import { useState, useEffect, useCallback } from "react";

interface BotStatus {
  running: boolean;
  status: string;
  username?: string | null;
  guilds?: number;
}

interface GuildConfigData {
  guildId?: string;
  channelAwanseDegradyId?: string;
  channelPlusyMinusyId?: string;
  channelPochwayNaganyId?: string;
  channelWypowiedzeniaId?: string;
  rolePracownikBsId?: string;
  roleZarzadId?: string;
  roleManagerId?: string;
  roleSupportId?: string;
  rolePlus1Id?: string;
  rolePlus2Id?: string;
  rolePlus3Id?: string;
  rolePochwala1Id?: string;
  rolePochwala2Id?: string;
  roleNagana1Id?: string;
  roleNagana2Id?: string;
  roleMinus1Id?: string;
  roleMinus2Id?: string;
  roleMinus3Id?: string;
  plusesForCommendation?: number;
  minusesForReprimand?: number;
  taryfikatorUrl?: string;
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
  firedAt?: string;
}

interface HistoryEntry {
  id: number;
  employeeId: string;
  discordUserId: string;
  actionType: string;
  performedBy: string;
  performedByUsername: string;
  previousPosition?: string;
  newPosition?: string;
  reason?: string;
  details?: string;
  createdAt: string;
}

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

const setupSQL = `-- ============================================================
-- 🍔 BurgerShot Manager Bot - Database Setup Script
-- Uruchom to na PostgreSQL (Neon.tech) aby stworzyć tabele
-- ============================================================

-- Create enums
DO $$ BEGIN
  CREATE TYPE employee_status AS ENUM ('active', 'fired', 'resigned');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE action_type AS ENUM (
    'hire', 'fire', 'promote', 'demote',
    'plus', 'minus', 'commendation', 'reprimand',
    'auto_promote', 'resignation', 'commendation_reset', 'reprimand_reset'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create tables
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

CREATE TABLE IF NOT EXISTS action_history (
  id SERIAL PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS guild_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL UNIQUE,
  channel_awanse_degrady_id TEXT,
  channel_plusy_minusy_id TEXT,
  channel_pochwaly_nagany_id TEXT,
  channel_wypowiedzenia_id TEXT,
  role_pracownik_bs_id TEXT,
  role_zarzad_id TEXT,
  role_manager_id TEXT,
  role_support_id TEXT,
  role_plus_1_id TEXT, role_plus_2_id TEXT, role_plus_3_id TEXT,
  role_pochwala_1_id TEXT, role_pochwala_2_id TEXT,
  role_nagana_1_id TEXT, role_nagana_2_id TEXT,
  role_minus_1_id TEXT, role_minus_2_id TEXT, role_minus_3_id TEXT,
  pluses_for_commendation INTEGER NOT NULL DEFAULT 3,
  minuses_for_reprimand INTEGER NOT NULL DEFAULT 3,
  taryfikator_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employees_discord_user_id ON employees(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_action_history_employee_id ON action_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_action_history_discord_user_id ON action_history(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_positions_guild_id ON positions(guild_id);`;

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"bot" | "config" | "positions" | "employees" | "sql">("bot");
  const [token, setToken] = useState("");
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [botMessage, setBotMessage] = useState("");
  const [guildId, setGuildId] = useState("");
  const [config, setConfig] = useState<GuildConfigData>({});
  const [configMessage, setConfigMessage] = useState("");
  const [positionsList, setPositionsList] = useState<Position[]>([]);
  const [newPosName, setNewPosName] = useState("");
  const [newPosRoleId, setNewPosRoleId] = useState("");
  const [newPosLevel, setNewPosLevel] = useState(1);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]);

  const fetchBotStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/bot");
      const data = await res.json();
      setBotStatus(data);
    } catch {
      setBotStatus({ running: false, status: "error" });
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    if (!guildId) return;
    try {
      const res = await fetch(`/api/config?guildId=${guildId}`);
      const data = await res.json();
      if (data.config) setConfig(data.config);
      if (data.positions) setPositionsList(data.positions);
    } catch {
      /* ignore */
    }
  }, [guildId]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (data.employees) setEmployeesList(data.employees);
      if (data.history) setHistoryList(data.history);
      if (data.positions) setAllPositions(data.positions);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchPositions = useCallback(async () => {
    if (!guildId) return;
    try {
      const res = await fetch(`/api/positions?guildId=${guildId}`);
      const data = await res.json();
      if (data.positions) setPositionsList(data.positions);
    } catch {
      /* ignore */
    }
  }, [guildId]);

  useEffect(() => {
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchBotStatus]);

  useEffect(() => {
    if (activeTab === "employees") fetchEmployees();
  }, [activeTab, fetchEmployees]);

  useEffect(() => {
    if (guildId && (activeTab === "config" || activeTab === "positions")) {
      fetchConfig();
    }
  }, [guildId, activeTab, fetchConfig]);

  const handleStartBot = async () => {
    setBotMessage("");
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", token }),
      });
      const data = await res.json();
      setBotMessage(data.message);
      fetchBotStatus();
    } catch {
      setBotMessage("❌ Błąd połączenia z serwerem");
    }
  };

  const handleStopBot = async () => {
    setBotMessage("");
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const data = await res.json();
      setBotMessage(data.message);
      fetchBotStatus();
    } catch {
      setBotMessage("❌ Błąd połączenia z serwerem");
    }
  };

  const handleSaveConfig = async () => {
    setConfigMessage("");
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, ...config }),
      });
      const data = await res.json();
      setConfigMessage(data.success ? "✅ Konfiguracja zapisana!" : `❌ ${data.error}`);
    } catch {
      setConfigMessage("❌ Błąd zapisu");
    }
  };

  const handleAddPosition = async () => {
    if (!guildId || !newPosName || !newPosRoleId) return;
    try {
      await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, name: newPosName, roleId: newPosRoleId, level: newPosLevel }),
      });
      setNewPosName("");
      setNewPosRoleId("");
      setNewPosLevel(positionsList.length + 1);
      fetchPositions();
    } catch {
      /* ignore */
    }
  };

  const handleDeletePosition = async (id: number) => {
    try {
      await fetch(`/api/positions?id=${id}&guildId=${guildId}`, { method: "DELETE" });
      fetchPositions();
    } catch {
      /* ignore */
    }
  };

  const tabs = [
    { id: "bot" as const, label: "🤖 Bot", icon: "🤖" },
    { id: "config" as const, label: "⚙️ Konfiguracja", icon: "⚙️" },
    { id: "positions" as const, label: "📋 Stanowiska", icon: "📋" },
    { id: "employees" as const, label: "👥 Pracownicy", icon: "👥" },
    { id: "sql" as const, label: "📄 SQL", icon: "📄" },
  ];

  return (
    <main className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🍔</span>
            <div>
              <h1 className="text-xl font-bold text-orange-400">BurgerShot Manager</h1>
              <p className="text-xs text-gray-400">Panel Administracyjny</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${botStatus?.running ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-sm text-gray-400">
              {botStatus?.running ? `Online — ${botStatus.username}` : "Offline"}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <nav className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-orange-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* BOT TAB */}
        {activeTab === "bot" && (
          <div className="space-y-6">
            {/* Status */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4 text-orange-400">📡 Status Bota</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Status</p>
                  <p className="text-sm font-medium">
                    {botStatus?.running ? (
                      <span className="text-green-400">✅ Online</span>
                    ) : (
                      <span className="text-red-400">❌ Offline</span>
                    )}
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Użytkownik</p>
                  <p className="text-sm font-medium">{botStatus?.username || "—"}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Serwery</p>
                  <p className="text-sm font-medium">{botStatus?.guilds ?? 0}</p>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4 text-orange-400">🎮 Kontrola Bota</h2>
              <div className="space-y-3">
                <label className="block text-sm text-gray-400">Token Discord Bota</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Wklej token bota..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={handleStartBot} className="px-6 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors">
                  ▶️ Uruchom
                </button>
                <button onClick={handleStopBot} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors">
                  ⏹️ Zatrzymaj
                </button>
              </div>
              {botMessage && (
                <div className="mt-4 p-3 bg-gray-800 rounded-lg text-sm">{botMessage}</div>
              )}
            </div>

            {/* Commands info */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4 text-orange-400">📋 Komendy Bota</h2>
              <div className="space-y-6">
                {/* Zarządzanie pracownikami */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">👥 Zarządzanie Pracownikami</h3>
                  <div className="grid gap-2">
                    {[
                      { cmd: "/zatrudnij", icon: "📥", desc: "Zatrudnij nowego pracownika", params: "@użytkownik, lvl (np. 1)", perm: "Manager+" },
                      { cmd: "/awans", icon: "📈", desc: "Daj awans pracownikowi", params: "@użytkownik", perm: "Manager+" },
                      { cmd: "/degraduj", icon: "📉", desc: "Degraduj pracownika", params: "@użytkownik, powód", perm: "Manager+" },
                      { cmd: "/zwolnij", icon: "❌", desc: "Zwolnij pracownika", params: "@użytkownik, powód", perm: "Manager+" },
                      { cmd: "/wypowiedzenie", icon: "📝", desc: "Wypowiedzenie / zwolnienie z archiwizacją", params: "@kto, powód", perm: "Manager+" },
                    ].map((c) => (
                      <div key={c.cmd} className="bg-gray-800 rounded-lg p-3 flex items-start gap-3">
                        <span className="text-xl">{c.icon}</span>
                        <div className="flex-1 min-w-0">
                          <code className="text-orange-400 text-sm font-mono">{c.cmd}</code>
                          <p className="text-xs text-gray-400 mt-0.5">{c.desc}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Parametry: {c.params}</p>
                        </div>
                        <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300 shrink-0">{c.perm}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* System ocen */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">⭐ System Ocen</h3>
                  <div className="grid gap-2">
                    {[
                      { cmd: "/plus", icon: "➕", desc: "Przyznaj plus pracownikowi (3 plusy = pochwała)", params: "@użytkownik, powód", perm: "Support+" },
                      { cmd: "/minus", icon: "➖", desc: "Przyznaj minus pracownikowi (3 minusy = nagana)", params: "@użytkownik, powód", perm: "Support+" },
                      { cmd: "/nagana", icon: "⚠️", desc: "Przyznaj naganę ręcznie (bez zbierania minusów)", params: "@użytkownik, powód", perm: "Manager+" },
                      { cmd: "/pochwala", icon: "🏆", desc: "Przyznaj pochwałę ręcznie (bez zbierania plusów)", params: "@użytkownik, powód", perm: "Manager+" },
                    ].map((c) => (
                      <div key={c.cmd} className="bg-gray-800 rounded-lg p-3 flex items-start gap-3">
                        <span className="text-xl">{c.icon}</span>
                        <div className="flex-1 min-w-0">
                          <code className="text-orange-400 text-sm font-mono">{c.cmd}</code>
                          <p className="text-xs text-gray-400 mt-0.5">{c.desc}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Parametry: {c.params}</p>
                        </div>
                        <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300 shrink-0">{c.perm}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Informacje */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">📊 Informacje</h3>
                  <div className="grid gap-2">
                    {[
                      { cmd: "/karta", icon: "📄", desc: "Pełna karta pracownika z historią", params: "@użytkownik", perm: "Support+" },
                      { cmd: "/pracownik", icon: "🔍", desc: "Szybkie info o pracowniku", params: "@użytkownik", perm: "Support+" },
                      { cmd: "/statystyki", icon: "📊", desc: "Statystyki Burger Shot", params: "brak", perm: "Support+" },
                      { cmd: "/ranking", icon: "🏆", desc: "Ranking pracowników", params: "brak", perm: "Support+" },
                    ].map((c) => (
                      <div key={c.cmd} className="bg-gray-800 rounded-lg p-3 flex items-start gap-3">
                        <span className="text-xl">{c.icon}</span>
                        <div className="flex-1 min-w-0">
                          <code className="text-orange-400 text-sm font-mono">{c.cmd}</code>
                          <p className="text-xs text-gray-400 mt-0.5">{c.desc}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Parametry: {c.params}</p>
                        </div>
                        <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300 shrink-0">{c.perm}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* System rang info */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">⭐ System Rang Plusów/Minusów</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-400">
                    <div>
                      <p className="font-semibold text-green-400 mb-2">Plusy → Pochwały → Awans</p>
                      <ul className="space-y-1">
                        <li>⭐ 1/3 — 1 plus</li>
                        <li>⭐⭐ 2/3 — 2 plusy</li>
                        <li>⭐⭐⭐ 3/3 → 🏆 1/2 Pochwała (reset plusów)</li>
                        <li>🏆 2/2 Pochwały → 🚀 Automatyczny awans!</li>
                      </ul>
                      <p className="mt-2 text-orange-400">
                        💡 Użyj <code className="font-mono">/pochwala</code> aby przyznać pochwałę ręcznie!
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-red-400 mb-2">Minusy → Nagany → Alert</p>
                      <ul className="space-y-1">
                        <li>❌ 1/3 — 1 minus</li>
                        <li>❌❌ 2/3 — 2 minusy</li>
                        <li>❌❌❌ 3/3 → ⚠️ 1/2 Nagana (reset minusów)</li>
                        <li>⚠️ 2/2 Nagany → 🚨 Powiadomienie zarządu</li>
                      </ul>
                      <p className="mt-2 text-orange-400">
                        💡 Użyj <code className="font-mono">/nagana</code> aby przyznać naganę ręcznie!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONFIG TAB */}
        {activeTab === "config" && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-6">
            <h2 className="text-lg font-semibold text-orange-400">⚙️ Konfiguracja Serwera</h2>

            <div className="space-y-2">
              <label className="block text-sm text-gray-400">ID Serwera (Guild ID)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={guildId}
                  onChange={(e) => {
                    setGuildId(e.target.value);
                    setConfig((c) => ({ ...c, guildId: e.target.value }));
                  }}
                  placeholder="np. 1234567890"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
                <button onClick={fetchConfig} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors text-sm">
                  📥 Załaduj
                </button>
              </div>
            </div>

            {configMessage && (
              <div className="p-3 bg-gray-800 rounded-lg text-sm">{configMessage}</div>
            )}

            {guildId && (
              <div className="space-y-6">
                {/* Channels */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">📗 Kanały</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {([
                      { key: "channelAwanseDegradyId" as const, label: "#awanse-degrady" },
                      { key: "channelPlusyMinusyId" as const, label: "#plusy-minusy" },
                      { key: "channelPochwayNaganyId" as const, label: "#pochwały-nagany" },
                      { key: "channelWypowiedzeniaId" as const, label: "#wypowiedzenia-zwolnienia" },
                    ] as const).map((ch) => (
                      <div key={ch.key}>
                        <label className="text-xs text-gray-400">{ch.label}</label>
                        <input
                          type="text"
                          value={(config as Record<string, string>)[ch.key] || ""}
                          onChange={(e) => setConfig((c) => ({ ...c, [ch.key]: e.target.value }))}
                          placeholder="ID kanału"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main roles */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">🛡️ Role Uprawnień</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {([
                      { key: "rolePracownikBsId" as const, label: "Pracownik BS" },
                      { key: "roleZarzadId" as const, label: "Zarząd" },
                      { key: "roleManagerId" as const, label: "Manager" },
                      { key: "roleSupportId" as const, label: "Support" },
                    ] as const).map((r) => (
                      <div key={r.key}>
                        <label className="text-xs text-gray-400">{r.label}</label>
                        <input
                          type="text"
                          value={(config as Record<string, string>)[r.key] || ""}
                          onChange={(e) => setConfig((c) => ({ ...c, [r.key]: e.target.value }))}
                          placeholder="ID roli"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plus roles */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">⭐ Role Plusów</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {([
                      { key: "rolePlus1Id" as const, label: "⭐ 1/3" },
                      { key: "rolePlus2Id" as const, label: "⭐⭐ 2/3" },
                      { key: "rolePlus3Id" as const, label: "⭐⭐⭐ 3/3" },
                    ] as const).map((r) => (
                      <div key={r.key}>
                        <label className="text-xs text-gray-400">{r.label}</label>
                        <input
                          type="text"
                          value={(config as Record<string, string>)[r.key] || ""}
                          onChange={(e) => setConfig((c) => ({ ...c, [r.key]: e.target.value }))}
                          placeholder="ID roli"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Commendation roles */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">🏆 Role Pochwał</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {([
                      { key: "rolePochwala1Id" as const, label: "🏆 1/2 Pochwała" },
                      { key: "rolePochwala2Id" as const, label: "🏆 2/2 Pochwały" },
                    ] as const).map((r) => (
                      <div key={r.key}>
                        <label className="text-xs text-gray-400">{r.label}</label>
                        <input
                          type="text"
                          value={(config as Record<string, string>)[r.key] || ""}
                          onChange={(e) => setConfig((c) => ({ ...c, [r.key]: e.target.value }))}
                          placeholder="ID roli"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Minus roles */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">❌ Role Minusów</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {([
                      { key: "roleMinus1Id" as const, label: "❌ 1/3" },
                      { key: "roleMinus2Id" as const, label: "❌❌ 2/3" },
                      { key: "roleMinus3Id" as const, label: "❌❌❌ 3/3" },
                    ] as const).map((r) => (
                      <div key={r.key}>
                        <label className="text-xs text-gray-400">{r.label}</label>
                        <input
                          type="text"
                          value={(config as Record<string, string>)[r.key] || ""}
                          onChange={(e) => setConfig((c) => ({ ...c, [r.key]: e.target.value }))}
                          placeholder="ID roli"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reprimand roles */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">⚠️ Role Nagan</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {([
                      { key: "roleNagana1Id" as const, label: "⚠️ 1/2 Nagana" },
                      { key: "roleNagana2Id" as const, label: "⚠️ 2/2 Nagany" },
                    ] as const).map((r) => (
                      <div key={r.key}>
                        <label className="text-xs text-gray-400">{r.label}</label>
                        <input
                          type="text"
                          value={(config as Record<string, string>)[r.key] || ""}
                          onChange={(e) => setConfig((c) => ({ ...c, [r.key]: e.target.value }))}
                          placeholder="ID roli"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Settings */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">🔧 Ustawienia</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-400">Plusy do pochwały</label>
                      <input
                        type="number"
                        value={config.plusesForCommendation ?? 3}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, plusesForCommendation: parseInt(e.target.value) || 3 }))
                        }
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Minusy do nagany</label>
                      <input
                        type="number"
                        value={config.minusesForReprimand ?? 3}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, minusesForReprimand: parseInt(e.target.value) || 3 }))
                        }
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">URL taryfikatora (grafika)</label>
                      <input
                        type="text"
                        value={config.taryfikatorUrl || ""}
                        onChange={(e) => setConfig((c) => ({ ...c, taryfikatorUrl: e.target.value }))}
                        placeholder="https://..."
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <button onClick={handleSaveConfig} className="w-full py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold transition-colors">
                  💾 Zapisz konfigurację
                </button>
              </div>
            )}
          </div>
        )}

        {/* POSITIONS TAB */}
        {activeTab === "positions" && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-orange-400">📋 Stanowiska (Hierarchia)</h2>
              <p className="text-sm text-gray-400 mt-1">
                Dodaj stanowiska od najniższego (level 1) do najwyższego. Bot automatycznie
                awansuje/degraduje na podstawie tej hierarchii.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-gray-400">ID Serwera</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={guildId}
                  onChange={(e) => setGuildId(e.target.value)}
                  placeholder="Guild ID"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
                <button onClick={fetchPositions} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors text-sm">
                  📥 Załaduj
                </button>
              </div>
            </div>

            {/* Existing positions */}
            {positionsList.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Aktualna hierarchia:</h3>
                <div className="space-y-2">
                  {positionsList.map((pos) => (
                    <div key={pos.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="bg-orange-600/20 text-orange-400 px-2 py-0.5 rounded text-xs font-mono">
                          Lv.{pos.level}
                        </span>
                        <span className="font-medium">{pos.name}</span>
                        <span className="text-xs text-gray-500">(Role: {pos.roleId})</span>
                      </div>
                      <button
                        onClick={() => handleDeletePosition(pos.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add position */}
            {guildId && (
              <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-300">Dodaj stanowisko:</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Nazwa</label>
                    <input
                      type="text"
                      value={newPosName}
                      onChange={(e) => setNewPosName(e.target.value)}
                      placeholder="np. Nowy"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">ID Roli Discord</label>
                    <input
                      type="text"
                      value={newPosRoleId}
                      onChange={(e) => setNewPosRoleId(e.target.value)}
                      placeholder="np. 123456789"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Level</label>
                    <input
                      type="number"
                      value={newPosLevel}
                      onChange={(e) => setNewPosLevel(parseInt(e.target.value) || 1)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 text-sm"
                    />
                  </div>
                </div>
                <button onClick={handleAddPosition} className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors">
                  ➕ Dodaj stanowisko
                </button>
              </div>
            )}
          </div>
        )}

        {/* EMPLOYEES TAB */}
        {activeTab === "employees" && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-orange-400">👥 Pracownicy</h2>
                <button onClick={fetchEmployees} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors text-sm">
                  🔄 Odśwież
                </button>
              </div>

              {employeesList.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Brak pracowników w bazie danych</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-800">
                        <th className="pb-2 px-2">Lv.</th>
                        <th className="pb-2 px-2">Użytkownik</th>
                        <th className="pb-2 px-2">Stanowisko</th>
                        <th className="pb-2 px-2">Status</th>
                        <th className="pb-2 px-2">Plusy</th>
                        <th className="pb-2 px-2">Minusy</th>
                        <th className="pb-2 px-2">Pochwały</th>
                        <th className="pb-2 px-2">Nagany</th>
                        <th className="pb-2 px-2">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeesList.map((emp) => {
                        const pos = allPositions.find((p) => p.name === emp.position);
                        return (
                          <tr key={emp.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                            <td className="py-2 px-2 text-orange-400 font-mono text-xs">
                              {pos?.level ?? "?"}
                            </td>
                            <td className="py-2 px-2 font-medium">{emp.discordUsername}</td>
                            <td className="py-2 px-2">{emp.position}</td>
                            <td className="py-2 px-2">
                              {emp.status === "active" ? (
                                <span className="text-green-400 text-xs">✅ Aktywny</span>
                              ) : (
                                <span className="text-red-400 text-xs">❌ {emp.status}</span>
                              )}
                            </td>
                            <td className="py-2 px-2">{emp.plusCount}</td>
                            <td className="py-2 px-2">{emp.minusCount}</td>
                            <td className="py-2 px-2">{emp.commendations}/2</td>
                            <td className="py-2 px-2">{emp.reprimands}/2</td>
                            <td className="py-2 px-2 text-xs text-gray-400">
                              {new Date(emp.hiredAt).toLocaleDateString("pl-PL")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent History */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold text-orange-400 mb-4">📜 Ostatnia Historia</h2>
              {historyList.length === 0 ? (
                <p className="text-gray-400 text-center py-4">Brak wpisów</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {historyList.slice(0, 50).map((h) => (
                    <div key={h.id} className="bg-gray-800 rounded-lg p-3 flex items-start gap-3">
                      <span className="text-lg shrink-0">
                        {actionLabels[h.actionType]?.split(" ")[0] || "📌"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {actionLabels[h.actionType]?.split(" ").slice(1).join(" ") || h.actionType}
                          </span>
                          {h.reason && (
                            <span className="text-xs text-gray-400 truncate"> — {h.reason}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
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
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold text-orange-400 mb-2">📄 SQL Export (dla Neon.tech)</h2>
              <p className="text-sm text-gray-400 mb-4">
                Skopiuj poniższe zapytania SQL i wklej je w konsoli SQL na Neon.tech aby stworzyć bazę danych.
              </p>
              <pre className="bg-gray-800 rounded-lg p-4 overflow-x-auto text-xs text-gray-300 font-mono whitespace-pre">
                {setupSQL}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(setupSQL)}
                className="mt-3 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm transition-colors"
              >
                📋 Kopiuj SQL
              </button>
            </div>

            {/* Render.com deployment info */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold text-orange-400 mb-4">🚀 Deployment na Render.com</h2>
              <div className="space-y-4 text-sm text-gray-300">
                <div>
                  <p className="font-semibold text-white">1. Zmienne środowiskowe</p>
                  <code className="block bg-gray-800 p-2 rounded mt-1 text-xs text-green-400">
                    DATABASE_URL=postgresql://user:pass@host/dbname<br />
                    DISCORD_TOKEN=twoj_token_bota
                  </code>
                </div>
                <div>
                  <p className="font-semibold text-white">2. Build Command</p>
                  <code className="block bg-gray-800 p-2 rounded mt-1 text-xs text-green-400">
                    npm install &amp;&amp; npm run build
                  </code>
                </div>
                <div>
                  <p className="font-semibold text-white">3. Start Command</p>
                  <code className="block bg-gray-800 p-2 rounded mt-1 text-xs text-green-400">
                    npm start
                  </code>
                </div>
                <div>
                  <p className="font-semibold text-white">4. Discord Developer Portal</p>
                  <p className="text-gray-400">Włącz w ustawieniach bota:</p>
                  <ul className="list-disc list-inside text-gray-400 ml-2">
                    <li>Server Members Intent ✅</li>
                    <li>Message Content Intent ✅</li>
                    <li>Presence Intent ✅</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-white">5. Uprawnienia bota</p>
                  <p className="text-gray-400">Bot potrzebuje uprawnień:</p>
                  <ul className="list-disc list-inside text-gray-400 ml-2">
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
    </main>
  );
}
