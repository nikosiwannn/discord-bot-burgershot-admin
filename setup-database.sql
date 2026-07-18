-- ============================================================
-- 🍔 BurgerShot Manager Bot - Database Setup Script
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
  
  -- 📗 Kanały logów
  channel_awanse_degrady_id TEXT,      -- #awanse-degrady
  channel_plusy_minusy_id TEXT,        -- #plusy-minusy
  channel_pochwaly_nagany_id TEXT,     -- #pochwały-nagany
  channel_wypowiedzenia_id TEXT,       -- #wypowiedzenia-zwolnienia
  
  -- 🛡️ Role uprawnień
  role_pracownik_bs_id TEXT,           -- Pracownik Burger Shot (ogólna)
  role_zarzad_id TEXT,                 -- Zarząd (pełny dostęp)
  role_manager_id TEXT,                -- Manager (zatrudnianie, awanse)
  role_support_id TEXT,                -- Support (plusy, minusy, podgląd)
  
  -- ⭐ Role plusów
  role_plus_1_id TEXT,                 -- ⭐ 1/3
  role_plus_2_id TEXT,                 -- ⭐⭐ 2/3
  role_plus_3_id TEXT,                 -- ⭐⭐⭐ 3/3
  
  -- ❌ Role minusów
  role_minus_1_id TEXT,                -- ❌ 1/3
  role_minus_2_id TEXT,                -- ❌❌ 2/3
  role_minus_3_id TEXT,                -- ❌❌❌ 3/3
  
  -- 🏆 Role pochwał
  role_pochwala_1_id TEXT,             -- 🏆 1/2 Pochwała
  role_pochwala_2_id TEXT,             -- 🏆 2/2 Pochwały
  
  -- ⚠️ Role nagan
  role_nagana_1_id TEXT,               -- ⚠️ 1/2 Nagana
  role_nagana_2_id TEXT,               -- ⚠️ 2/2 Nagany
  
  -- ⚙️ Ustawienia
  pluses_for_commendation INTEGER NOT NULL DEFAULT 3,   -- Ile plusów do pochwały
  minuses_for_reprimand INTEGER NOT NULL DEFAULT 3,     -- Ile minusów do nagany
  taryfikator_url TEXT,                                 -- URL grafiki taryfikatora
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stanowiska (hierarchia od 1 = najniższe)
CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,                  -- np. "Nowy", "Adept", "Pracownik"
  role_id TEXT NOT NULL,               -- ID roli Discord
  level INTEGER NOT NULL,              -- 1 = najniższe, wyżej = wyższe
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_employees_discord_user_id ON employees(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_action_history_employee_id ON action_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_action_history_discord_user_id ON action_history(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_positions_guild_id ON positions(guild_id);

-- ==================== EXAMPLE DATA (optional) ====================
-- Przykładowe stanowiska - odkomentuj i dostosuj ID ról do swojego serwera:

-- INSERT INTO positions (guild_id, name, role_id, level) VALUES
-- ('TWOJE_GUILD_ID', 'Nowy', 'ID_ROLI_NOWY', 1),
-- ('TWOJE_GUILD_ID', 'Adept', 'ID_ROLI_ADEPT', 2),
-- ('TWOJE_GUILD_ID', 'Młodszy Pracownik', 'ID_ROLI_MLODSZY', 3),
-- ('TWOJE_GUILD_ID', 'Pracownik', 'ID_ROLI_PRACOWNIK', 4),
-- ('TWOJE_GUILD_ID', 'Starszy Pracownik', 'ID_ROLI_STARSZY', 5),
-- ('TWOJE_GUILD_ID', 'Manager', 'ID_ROLI_MANAGER', 6);

-- ==================== DONE ====================
-- ✅ Tabele utworzone! 
-- 🌐 Teraz skonfiguruj bota przez panel webowy.
-- 🔗 Wejdź na stronę bota i uzupełnij ID kanałów oraz ról.
