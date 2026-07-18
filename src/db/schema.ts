import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  uuid,
  pgEnum,
  serial,
} from "drizzle-orm/pg-core";

// ==================== ENUMS ====================

export const employeeStatusEnum = pgEnum("employee_status", [
  "active",
  "fired",
  "resigned",
]);

export const actionTypeEnum = pgEnum("action_type", [
  "hire",
  "fire",
  "promote",
  "demote",
  "plus",
  "minus",
  "commendation",
  "reprimand",
  "auto_promote",
  "resignation",
  "commendation_reset",
  "reprimand_reset",
]);

// ==================== TABLES ====================

// Pracownicy
export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  discordUserId: text("discord_user_id").notNull(),
  discordUsername: text("discord_username").notNull(),
  position: text("position").notNull(),
  status: employeeStatusEnum("status").default("active").notNull(),
  plusCount: integer("plus_count").default(0).notNull(),
  minusCount: integer("minus_count").default(0).notNull(),
  commendations: integer("commendations").default(0).notNull(), // 0, 1, 2
  reprimands: integer("reprimands").default(0).notNull(), // 0, 1, 2
  hiredAt: timestamp("hired_at", { withTimezone: true }).defaultNow().notNull(),
  hiredBy: text("hired_by").notNull(),
  firedAt: timestamp("fired_at", { withTimezone: true }),
  firedBy: text("fired_by"),
  fireReason: text("fire_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Historia akcji
export const actionHistory = pgTable("action_history", {
  id: serial("id").primaryKey(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  discordUserId: text("discord_user_id").notNull(),
  actionType: actionTypeEnum("action_type").notNull(),
  performedBy: text("performed_by").notNull(),
  performedByUsername: text("performed_by_username").notNull(),
  previousPosition: text("previous_position"),
  newPosition: text("new_position"),
  reason: text("reason"),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Konfiguracja serwera
export const guildConfig = pgTable("guild_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  // Kanały
  channelAwanseDegradyId: text("channel_awanse_degrady_id"),
  channelPlusyMinusyId: text("channel_plusy_minusy_id"),
  channelPochwayNaganyId: text("channel_pochwaly_nagany_id"),
  channelWypowiedzeniaId: text("channel_wypowiedzenia_id"),
  // Role stanowisk (od najniższej do najwyższej)
  rolePracownikBsId: text("role_pracownik_bs_id"), // Pracownik Burger Shot (ogólna)
  // Role systemowe
  roleZarzadId: text("role_zarzad_id"),
  roleManagerId: text("role_manager_id"),
  roleSupportId: text("role_support_id"),
  // Role plusów
  rolePlus1Id: text("role_plus_1_id"), // ⭐ 1/3
  rolePlus2Id: text("role_plus_2_id"), // ⭐⭐ 2/3
  rolePlus3Id: text("role_plus_3_id"), // ⭐⭐⭐ 3/3
  // Role pochwał
  rolePochwala1Id: text("role_pochwala_1_id"), // 🏆 1/2 Pochwała
  rolePochwala2Id: text("role_pochwala_2_id"), // 🏆 2/2 Pochwały
  // Role nagan
  roleNagana1Id: text("role_nagana_1_id"), // ⚠️ 1/2 Nagana
  roleNagana2Id: text("role_nagana_2_id"), // ⚠️ 2/2 Nagany
  // Role minusów
  roleMinus1Id: text("role_minus_1_id"), // ❌ 1/3
  roleMinus2Id: text("role_minus_2_id"), // ❌❌ 2/3
  roleMinus3Id: text("role_minus_3_id"), // ❌❌❌ 3/3
  // Ustawienia
  plusesForCommendation: integer("pluses_for_commendation").default(3).notNull(),
  minusesForReprimand: integer("minuses_for_reprimand").default(3).notNull(),
  // Grafika taryfikatora
  taryfikatorUrl: text("taryfikator_url"),
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Stanowiska (hierarchia)
export const positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  name: text("name").notNull(),
  roleId: text("role_id").notNull(),
  level: integer("level").notNull(), // 1 = najniższe, wyżej = wyższe
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
