-- ============================================================
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
