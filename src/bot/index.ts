/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  type Interaction,
  type Guild,
  type TextChannel,
  type GuildMember,
} from "discord.js";
import { db } from "../db";
import { employees, actionHistory, guildConfig, positions } from "../db/schema";
import { eq, and, desc, sql, asc } from "drizzle-orm";
import {
  COLOR_PRIMARY,
  COLOR_SUCCESS,
  COLOR_ERROR,
  COLOR_WARNING,
  COLOR_PLUS,
  COLOR_MINUS,
  COLOR_COMMENDATION,
  COLOR_REPRIMAND,
  COLOR_HIRE,
  COLOR_FIRE,
  COLOR_PROMOTE,
  COLOR_DEMOTE,
} from "../lib/constants";

let client: Client | null = null;

// =================== HELPERS ===================

function formatDatePL(date: Date): string {
  return date.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// =================== EXPORTS ===================

export function getClient() {
  return client;
}

export function getBotStatus() {
  if (!client) return { running: false, status: "not_initialized" };
  return {
    running: client.isReady(),
    status: client.isReady() ? "online" : "connecting",
    username: client.user?.tag ?? null,
    guilds: client.guilds.cache.size,
  };
}

// =================== PERMISSION CHECK ===================

async function checkPermission(
  interaction: any,
  requiredLevel: "zarzad" | "manager" | "support"
): Promise<boolean> {
  const guildId = interaction.guild?.id;
  if (!guildId) {
    await interaction.reply({ content: "❌ Ta komenda działa tylko na serwerze.", ephemeral: true });
    return false;
  }
  const config = await getGuildConfig(guildId);
  if (!config) {
    await interaction.reply({ content: "❌ Brak konfiguracji serwera. Ustaw config w panelu webowym.", ephemeral: true });
    return false;
  }

  const member = interaction.member as GuildMember;
  const roles = member.roles.cache;

  // Zarząd ma dostęp do wszystkiego
  if (config.roleZarzadId && roles.has(config.roleZarzadId)) return true;

  // Manager ma dostęp do zatrudniania, awansów, plusów, minusów
  if (requiredLevel === "manager" || requiredLevel === "support") {
    if (config.roleManagerId && roles.has(config.roleManagerId)) return true;
  }

  // Support ma dostęp do plusów, minusów i podglądu kart
  if (requiredLevel === "support") {
    if (config.roleSupportId && roles.has(config.roleSupportId)) return true;
  }

  await interaction.reply({
    content: "❌ Nie masz uprawnień do użycia tej komendy!",
    ephemeral: true,
  });
  return false;
}

// =================== GET CONFIG ===================

async function getGuildConfig(guildId: string) {
  const configs = await db
    .select()
    .from(guildConfig)
    .where(eq(guildConfig.guildId, guildId));
  return configs[0] ?? null;
}

async function getPositions(guildId: string) {
  return db
    .select()
    .from(positions)
    .where(eq(positions.guildId, guildId))
    .orderBy(asc(positions.level));
}

async function getNextPosition(guildId: string, currentPosition: string) {
  const allPositions = await getPositions(guildId);
  const currentIdx = allPositions.findIndex((p) => p.name === currentPosition);
  if (currentIdx === -1 || currentIdx >= allPositions.length - 1) return null;
  return allPositions[currentIdx + 1];
}

async function getPrevPosition(guildId: string, currentPosition: string) {
  const allPositions = await getPositions(guildId);
  const currentIdx = allPositions.findIndex((p) => p.name === currentPosition);
  if (currentIdx <= 0) return null;
  return allPositions[currentIdx - 1];
}

async function getPositionByName(guildId: string, name: string) {
  const allPositions = await getPositions(guildId);
  return allPositions.find((p) => p.name === name) ?? null;
}

// =================== REGISTER COMMANDS ===================

async function registerCommands(token: string, clientId: string) {
  const commands = [
    new SlashCommandBuilder()
      .setName("zatrudnij")
      .setDescription("Zatrudnij nowego pracownika Burger Shot")
      .addUserOption((opt) =>
        opt.setName("użytkownik").setDescription("Kogo zatrudnić").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("stanowisko").setDescription("Stanowisko pracownika").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("awans")
      .setDescription("Daj awans pracownikowi")
      .addUserOption((opt) =>
        opt.setName("użytkownik").setDescription("Kogo awansować").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("degraduj")
      .setDescription("Degraduj pracownika")
      .addUserOption((opt) =>
        opt.setName("użytkownik").setDescription("Kogo degradować").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("powód").setDescription("Powód degradacji").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("zwolnij")
      .setDescription("Zwolnij pracownika")
      .addUserOption((opt) =>
        opt.setName("użytkownik").setDescription("Kogo zwolnić").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("powód").setDescription("Powód zwolnienia").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("plus")
      .setDescription("Przyznaj plus pracownikowi")
      .addUserOption((opt) =>
        opt.setName("użytkownik").setDescription("Komu dać plusa").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("powód").setDescription("Powód przyznania plusa").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("minus")
      .setDescription("Przyznaj minus pracownikowi")
      .addUserOption((opt) =>
        opt.setName("użytkownik").setDescription("Komu dać minusa").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("powód").setDescription("Powód przyznania minusa").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("karta")
      .setDescription("Wyświetl kartę pracownika")
      .addUserOption((opt) =>
        opt.setName("użytkownik").setDescription("Którego pracownika sprawdzić").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("pracownik")
      .setDescription("Wyszukaj informacje o pracowniku")
      .addUserOption((opt) =>
        opt.setName("użytkownik").setDescription("Którego pracownika wyszukać").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("statystyki")
      .setDescription("Pokaż statystyki Burger Shot"),

    new SlashCommandBuilder()
      .setName("ranking")
      .setDescription("Pokaż ranking pracowników"),

    new SlashCommandBuilder()
      .setName("wypowiedzenie")
      .setDescription("Złóż wypowiedzenie / zwolnij (formularz)")
      .addUserOption((opt) =>
        opt.setName("kto").setDescription("Kogo dotyczy").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("powód").setDescription("Powód wypowiedzenia").setRequired(true)
      ),
  ];

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log("[BOT] Rejestrowanie komend slash...");
    await rest.put(Routes.applicationCommands(clientId), {
      body: commands.map((c) => c.toJSON()),
    });
    console.log("[BOT] Komendy zarejestrowane!");
  } catch (err) {
    console.error("[BOT] Błąd rejestracji komend:", err);
  }
}

// =================== ROLE HELPERS ===================

async function safeAddRole(guild: Guild, userId: string, roleId: string) {
  try {
    const member =
      guild.members.cache.get(userId) ||
      (await guild.members.fetch(userId).catch(() => null));
    if (!member) return false;
    const role = guild.roles.cache.get(roleId);
    if (!role) return false;
    await member.roles.add(role);
    return true;
  } catch {
    return false;
  }
}

async function safeRemoveRole(guild: Guild, userId: string, roleId: string) {
  try {
    const member =
      guild.members.cache.get(userId) ||
      (await guild.members.fetch(userId).catch(() => null));
    if (!member) return false;
    const role = guild.roles.cache.get(roleId);
    if (!role) return false;
    await member.roles.remove(role);
    return true;
  } catch {
    return false;
  }
}

async function removeAllBsRoles(guild: Guild, userId: string, config: any) {
  const roleIds = [
    config.rolePracownikBsId,
    config.rolePlus1Id,
    config.rolePlus2Id,
    config.rolePlus3Id,
    config.rolePochwala1Id,
    config.rolePochwala2Id,
    config.roleNagana1Id,
    config.roleNagana2Id,
  ].filter(Boolean);

  // Also remove all position roles
  const guildPositions = await getPositions(guild.id);
  for (const pos of guildPositions) {
    roleIds.push(pos.roleId);
  }

  for (const roleId of roleIds) {
    await safeRemoveRole(guild, userId, roleId);
  }
}

async function updatePlusRoles(
  guild: Guild,
  userId: string,
  config: any,
  plusCount: number
) {
  // Remove all plus roles first
  if (config.rolePlus1Id) await safeRemoveRole(guild, userId, config.rolePlus1Id);
  if (config.rolePlus2Id) await safeRemoveRole(guild, userId, config.rolePlus2Id);
  if (config.rolePlus3Id) await safeRemoveRole(guild, userId, config.rolePlus3Id);

  // Add the appropriate one
  if (plusCount >= 3 && config.rolePlus3Id) {
    await safeAddRole(guild, userId, config.rolePlus3Id);
  } else if (plusCount === 2 && config.rolePlus2Id) {
    await safeAddRole(guild, userId, config.rolePlus2Id);
  } else if (plusCount === 1 && config.rolePlus1Id) {
    await safeAddRole(guild, userId, config.rolePlus1Id);
  }
}

async function updateCommendationRoles(
  guild: Guild,
  userId: string,
  config: any,
  commendations: number
) {
  if (config.rolePochwala1Id) await safeRemoveRole(guild, userId, config.rolePochwala1Id);
  if (config.rolePochwala2Id) await safeRemoveRole(guild, userId, config.rolePochwala2Id);

  if (commendations === 2 && config.rolePochwala2Id) {
    await safeAddRole(guild, userId, config.rolePochwala2Id);
  } else if (commendations === 1 && config.rolePochwala1Id) {
    await safeAddRole(guild, userId, config.rolePochwala1Id);
  }
}

async function updateReprimandRoles(
  guild: Guild,
  userId: string,
  config: any,
  reprimands: number
) {
  if (config.roleNagana1Id) await safeRemoveRole(guild, userId, config.roleNagana1Id);
  if (config.roleNagana2Id) await safeRemoveRole(guild, userId, config.roleNagana2Id);

  if (reprimands === 2 && config.roleNagana2Id) {
    await safeAddRole(guild, userId, config.roleNagana2Id);
  } else if (reprimands === 1 && config.roleNagana1Id) {
    await safeAddRole(guild, userId, config.roleNagana1Id);
  }
}

// =================== SEND LOG ===================

async function sendLog(guild: Guild, channelId: string | null, embed: EmbedBuilder) {
  if (!channelId) return;
  try {
    const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (channel) await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error("[BOT] sendLog error:", e);
  }
}

// =================== DM HELPER ===================

async function sendDM(userId: string, embed: EmbedBuilder, imageUrl?: string | null) {
  if (!client) return;
  try {
    const user = await client.users.fetch(userId);
    const options: any = { embeds: [embed] };
    await user.send(options);
    if (imageUrl) {
      await user.send({ content: imageUrl });
    }
  } catch {
    console.log(`[BOT] Could not DM user ${userId}`);
  }
}

// =================== COMMAND HANDLERS ===================

async function handleZatrudnij(interaction: any) {
  if (!(await checkPermission(interaction, "manager"))) return;

  const targetUser = interaction.options.getUser("użytkownik");
  const positionName = interaction.options.getString("stanowisko");
  const guild = interaction.guild as Guild;
  const config = await getGuildConfig(guild.id);
  if (!config) {
    await interaction.reply({ content: "❌ Brak konfiguracji serwera!", ephemeral: true });
    return;
  }

  // Check if already employed
  const existing = await db
    .select()
    .from(employees)
    .where(and(eq(employees.discordUserId, targetUser.id), eq(employees.status, "active")));

  if (existing.length > 0) {
    await interaction.reply({
      content: `❌ **${targetUser.username}** jest już zatrudniony jako **${existing[0].position}**!`,
      ephemeral: true,
    });
    return;
  }

  // Find position role
  const pos = await getPositionByName(guild.id, positionName);
  if (!pos) {
    await interaction.reply({
      content: `❌ Stanowisko **${positionName}** nie istnieje! Dodaj je w panelu konfiguracyjnym.`,
      ephemeral: true,
    });
    return;
  }

  // Create employee record
  const [employee] = await db
    .insert(employees)
    .values({
      discordUserId: targetUser.id,
      discordUsername: targetUser.username,
      position: positionName,
      status: "active",
      hiredBy: interaction.user.id,
    })
    .returning();

  // Log action
  await db.insert(actionHistory).values({
    employeeId: employee.id,
    discordUserId: targetUser.id,
    actionType: "hire",
    performedBy: interaction.user.id,
    performedByUsername: interaction.user.username,
    newPosition: positionName,
    reason: "Zatrudnienie",
  });

  // Assign roles
  if (config.rolePracownikBsId) {
    await safeAddRole(guild, targetUser.id, config.rolePracownikBsId);
  }
  await safeAddRole(guild, targetUser.id, pos.roleId);

  // Reply
  const replyEmbed = new EmbedBuilder()
    .setTitle("✅ Pracownik Zatrudniony!")
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👤 **Pracownik:** <@${targetUser.id}>\n` +
        `> 💼 **Stanowisko:** ${positionName}\n` +
        `> 📅 **Data:** ${formatDatePL(new Date())}\n` +
        `> 👮 **Zatrudnił:** <@${interaction.user.id}>`
    )
    .setColor(COLOR_HIRE)
    .setFooter({ text: "🍔 BurgerShot HR" })
    .setTimestamp();

  await interaction.reply({ embeds: [replyEmbed] });

  // Send DM to new employee
  const dmEmbed = new EmbedBuilder()
    .setTitle("🍔 Witamy w Burger Shot!")
    .setDescription(
      `Cześć **${targetUser.username}**!\n\n` +
        `Zostałeś zatrudniony w **Burger Shot** na stanowisku **${positionName}**.\n\n` +
        `📋 Poniżej znajdziesz taryfikator Burger Shot.\n` +
        `🏠 Za chwilę zostaniesz oprowadzony po restauracji.\n\n` +
        `Życzymy owocnej pracy! 🎉`
    )
    .setColor(COLOR_HIRE)
    .setFooter({ text: "🍔 BurgerShot HR" })
    .setTimestamp();

  await sendDM(targetUser.id, dmEmbed, config.taryfikatorUrl);

  // Log to #awanse-degrady
  const logEmbed = new EmbedBuilder()
    .setAuthor({ name: "🍔 BurgerShot HR • Zatrudnienie" })
    .setTitle(`📥 Nowy Pracownik`)
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👤 **Pracownik:** <@${targetUser.id}> (${targetUser.username})\n` +
        `> 💼 **Stanowisko:** ${positionName}\n` +
        `> 📅 **Data:** ${formatDatePL(new Date())}\n` +
        `> 👮 **Zatrudnił:** <@${interaction.user.id}>`
    )
    .setColor(COLOR_HIRE)
    .setFooter({ text: `ID: ${employee.id}` })
    .setTimestamp();

  await sendLog(guild, config.channelAwanseDegradyId, logEmbed);
}

async function handleAwans(interaction: any) {
  if (!(await checkPermission(interaction, "manager"))) return;

  const targetUser = interaction.options.getUser("użytkownik");
  const guild = interaction.guild as Guild;
  const config = await getGuildConfig(guild.id);
  if (!config) {
    await interaction.reply({ content: "❌ Brak konfiguracji!", ephemeral: true });
    return;
  }

  const emps = await db
    .select()
    .from(employees)
    .where(and(eq(employees.discordUserId, targetUser.id), eq(employees.status, "active")));

  if (emps.length === 0) {
    await interaction.reply({ content: "❌ Ten użytkownik nie jest pracownikiem!", ephemeral: true });
    return;
  }

  const emp = emps[0];
  const nextPos = await getNextPosition(guild.id, emp.position);

  if (!nextPos) {
    await interaction.reply({
      content: `❌ **${targetUser.username}** ma już najwyższe stanowisko (**${emp.position}**)!`,
      ephemeral: true,
    });
    return;
  }

  // Remove old position role
  const oldPos = await getPositionByName(guild.id, emp.position);
  if (oldPos) await safeRemoveRole(guild, targetUser.id, oldPos.roleId);

  // Add new position role
  await safeAddRole(guild, targetUser.id, nextPos.roleId);

  // Update DB
  await db
    .update(employees)
    .set({ position: nextPos.name, updatedAt: new Date() })
    .where(eq(employees.id, emp.id));

  await db.insert(actionHistory).values({
    employeeId: emp.id,
    discordUserId: targetUser.id,
    actionType: "promote",
    performedBy: interaction.user.id,
    performedByUsername: interaction.user.username,
    previousPosition: emp.position,
    newPosition: nextPos.name,
  });

  const replyEmbed = new EmbedBuilder()
    .setTitle("📈 Awans!")
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👤 **Pracownik:** <@${targetUser.id}>\n` +
        `> 📤 **Poprzednie:** ${emp.position}\n` +
        `> 📥 **Nowe:** ${nextPos.name}\n` +
        `> 📅 **Data:** ${formatDatePL(new Date())}\n` +
        `> 👮 **Awansował:** <@${interaction.user.id}>`
    )
    .setColor(COLOR_PROMOTE)
    .setFooter({ text: "🍔 BurgerShot HR" })
    .setTimestamp();

  await interaction.reply({ embeds: [replyEmbed] });

  const logEmbed = new EmbedBuilder()
    .setAuthor({ name: "🍔 BurgerShot HR • Awans" })
    .setTitle(`📈 Awans Pracownika`)
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👤 **Pracownik:** <@${targetUser.id}> (${targetUser.username})\n` +
        `> 📤 **Poprzednie stanowisko:** ${emp.position}\n` +
        `> 📥 **Nowe stanowisko:** ${nextPos.name}\n` +
        `> 📅 **Data:** ${formatDatePL(new Date())}\n` +
        `> 👮 **Awansował:** <@${interaction.user.id}>`
    )
    .setColor(COLOR_PROMOTE)
    .setTimestamp();

  await sendLog(guild, config.channelAwanseDegradyId, logEmbed);
}

async function handleDegraduj(interaction: any) {
  if (!(await checkPermission(interaction, "manager"))) return;

  const targetUser = interaction.options.getUser("użytkownik");
  const reason = interaction.options.getString("powód");
  const guild = interaction.guild as Guild;
  const config = await getGuildConfig(guild.id);
  if (!config) {
    await interaction.reply({ content: "❌ Brak konfiguracji!", ephemeral: true });
    return;
  }

  const emps = await db
    .select()
    .from(employees)
    .where(and(eq(employees.discordUserId, targetUser.id), eq(employees.status, "active")));

  if (emps.length === 0) {
    await interaction.reply({ content: "❌ Ten użytkownik nie jest pracownikiem!", ephemeral: true });
    return;
  }

  const emp = emps[0];
  const prevPos = await getPrevPosition(guild.id, emp.position);

  if (!prevPos) {
    await interaction.reply({
      content: `❌ **${targetUser.username}** ma już najniższe stanowisko (**${emp.position}**)!`,
      ephemeral: true,
    });
    return;
  }

  const oldPos = await getPositionByName(guild.id, emp.position);
  if (oldPos) await safeRemoveRole(guild, targetUser.id, oldPos.roleId);
  await safeAddRole(guild, targetUser.id, prevPos.roleId);

  await db
    .update(employees)
    .set({ position: prevPos.name, updatedAt: new Date() })
    .where(eq(employees.id, emp.id));

  await db.insert(actionHistory).values({
    employeeId: emp.id,
    discordUserId: targetUser.id,
    actionType: "demote",
    performedBy: interaction.user.id,
    performedByUsername: interaction.user.username,
    previousPosition: emp.position,
    newPosition: prevPos.name,
    reason,
  });

  const replyEmbed = new EmbedBuilder()
    .setTitle("📉 Degradacja")
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👤 **Pracownik:** <@${targetUser.id}>\n` +
        `> 📤 **Poprzednie:** ${emp.position}\n` +
        `> 📥 **Nowe:** ${prevPos.name}\n` +
        `> 📜 **Powód:** ${reason}\n` +
        `> 📅 **Data:** ${formatDatePL(new Date())}\n` +
        `> 👮 **Degradował:** <@${interaction.user.id}>`
    )
    .setColor(COLOR_DEMOTE)
    .setFooter({ text: "🍔 BurgerShot HR" })
    .setTimestamp();

  await interaction.reply({ embeds: [replyEmbed] });

  const logEmbed = new EmbedBuilder()
    .setAuthor({ name: "🍔 BurgerShot HR • Degradacja" })
    .setTitle(`📉 Degradacja Pracownika`)
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👤 **Pracownik:** <@${targetUser.id}> (${targetUser.username})\n` +
        `> 📤 **Poprzednie stanowisko:** ${emp.position}\n` +
        `> 📥 **Nowe stanowisko:** ${prevPos.name}\n` +
        `> 📜 **Powód:** ${reason}\n` +
        `> 👮 **Degradował:** <@${interaction.user.id}>`
    )
    .setColor(COLOR_DEMOTE)
    .setTimestamp();

  await sendLog(guild, config.channelAwanseDegradyId, logEmbed);
}

async function handleZwolnij(interaction: any) {
  if (!(await checkPermission(interaction, "manager"))) return;

  const targetUser = interaction.options.getUser("użytkownik");
  const reason = interaction.options.getString("powód");
  const guild = interaction.guild as Guild;
  const config = await getGuildConfig(guild.id);
  if (!config) {
    await interaction.reply({ content: "❌ Brak konfiguracji!", ephemeral: true });
    return;
  }

  const emps = await db
    .select()
    .from(employees)
    .where(and(eq(employees.discordUserId, targetUser.id), eq(employees.status, "active")));

  if (emps.length === 0) {
    await interaction.reply({ content: "❌ Ten użytkownik nie jest pracownikiem!", ephemeral: true });
    return;
  }

  const emp = emps[0];

  // Remove all BS roles
  await removeAllBsRoles(guild, targetUser.id, config);

  // Update DB
  await db
    .update(employees)
    .set({
      status: "fired",
      firedAt: new Date(),
      firedBy: interaction.user.id,
      fireReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, emp.id));

  await db.insert(actionHistory).values({
    employeeId: emp.id,
    discordUserId: targetUser.id,
    actionType: "fire",
    performedBy: interaction.user.id,
    performedByUsername: interaction.user.username,
    previousPosition: emp.position,
    reason,
  });

  const replyEmbed = new EmbedBuilder()
    .setTitle("❌ Pracownik Zwolniony")
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👤 **Pracownik:** <@${targetUser.id}>\n` +
        `> 💼 **Stanowisko:** ${emp.position}\n` +
        `> 📜 **Powód:** ${reason}\n` +
        `> 📅 **Data:** ${formatDatePL(new Date())}\n` +
        `> 👮 **Zwolnił:** <@${interaction.user.id}>`
    )
    .setColor(COLOR_FIRE)
    .setFooter({ text: "🍔 BurgerShot HR" })
    .setTimestamp();

  await interaction.reply({ embeds: [replyEmbed] });

  // DM
  const dmEmbed = new EmbedBuilder()
    .setTitle("❌ Zostałeś zwolniony z Burger Shot")
    .setDescription(
      `Niestety Twoje zatrudnienie w **Burger Shot** zostało zakończone.\n\n` +
        `> 💼 **Stanowisko:** ${emp.position}\n` +
        `> 📜 **Powód:** ${reason}\n` +
        `> 📅 **Data:** ${formatDatePL(new Date())}`
    )
    .setColor(COLOR_FIRE)
    .setFooter({ text: "🍔 BurgerShot HR" })
    .setTimestamp();

  await sendDM(targetUser.id, dmEmbed);

  // Log
  const logEmbed = new EmbedBuilder()
    .setAuthor({ name: "🍔 BurgerShot HR • Zwolnienie" })
    .setTitle(`❌ Zwolnienie Pracownika`)
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👤 **Pracownik:** <@${targetUser.id}> (${targetUser.username})\n` +
        `> 💼 **Stanowisko:** ${emp.position}\n` +
        `> 📜 **Powód:** ${reason}\n` +
        `> 👮 **Zwolnił:** <@${interaction.user.id}>`
    )
    .setColor(COLOR_FIRE)
    .setTimestamp();

  await sendLog(guild, config.channelAwanseDegradyId, logEmbed);
}

// =================== PLUS ===================

async function handlePlus(interaction: any) {
  if (!(await checkPermission(interaction, "support"))) return;

  const targetUser = interaction.options.getUser("użytkownik");
  const reason = interaction.options.getString("powód");
  const guild = interaction.guild as Guild;
  const config = await getGuildConfig(guild.id);
  if (!config) {
    await interaction.reply({ content: "❌ Brak konfiguracji!", ephemeral: true });
    return;
  }

  const emps = await db
    .select()
    .from(employees)
    .where(and(eq(employees.discordUserId, targetUser.id), eq(employees.status, "active")));

  if (emps.length === 0) {
    await interaction.reply({ content: "❌ Ten użytkownik nie jest pracownikiem!", ephemeral: true });
    return;
  }

  const emp = emps[0];
  const threshold = config.plusesForCommendation;
  let newPlusCount = emp.plusCount + 1;
  let newCommendations = emp.commendations;
  let autoPromoted = false;

  await db.insert(actionHistory).values({
    employeeId: emp.id,
    discordUserId: targetUser.id,
    actionType: "plus",
    performedBy: interaction.user.id,
    performedByUsername: interaction.user.username,
    reason,
    details: `Plus ${newPlusCount}/${threshold}`,
  });

  // Check if reached threshold for commendation
  if (newPlusCount >= threshold) {
    newPlusCount = 0;
    newCommendations += 1;

    // Remove plus roles
    if (config.rolePlus1Id) await safeRemoveRole(guild, targetUser.id, config.rolePlus1Id);
    if (config.rolePlus2Id) await safeRemoveRole(guild, targetUser.id, config.rolePlus2Id);
    if (config.rolePlus3Id) await safeRemoveRole(guild, targetUser.id, config.rolePlus3Id);

    await db.insert(actionHistory).values({
      employeeId: emp.id,
      discordUserId: targetUser.id,
      actionType: "commendation",
      performedBy: interaction.user.id,
      performedByUsername: interaction.user.username,
      details: `Pochwała ${newCommendations}/2`,
    });

    // Update commendation roles
    await updateCommendationRoles(guild, targetUser.id, config, newCommendations);

    // Log commendation
    const commEmbed = new EmbedBuilder()
      .setAuthor({ name: "🍔 BurgerShot HR • Pochwała" })
      .setTitle(`🏆 Pochwała ${newCommendations}/2`)
      .setDescription(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `> 👤 **Pracownik:** <@${targetUser.id}> (${targetUser.username})\n` +
          `> 🏆 **Pochwały:** ${newCommendations}/2\n` +
          `> 📅 **Data:** ${formatDatePL(new Date())}\n\n` +
          `Pracownik zebrał ${threshold} plusów i otrzymał pochwałę!`
      )
      .setColor(COLOR_COMMENDATION)
      .setTimestamp();

    await sendLog(guild, config.channelPochwayNaganyId, commEmbed);

    // Check for auto-promotion (2/2 commendations)
    if (newCommendations >= 2) {
      const nextPos = await getNextPosition(guild.id, emp.position);
      if (nextPos) {
        autoPromoted = true;

        const oldPos = await getPositionByName(guild.id, emp.position);
        if (oldPos) await safeRemoveRole(guild, targetUser.id, oldPos.roleId);
        await safeAddRole(guild, targetUser.id, nextPos.roleId);

        // Reset commendations
        newCommendations = 0;
        if (config.rolePochwala1Id) await safeRemoveRole(guild, targetUser.id, config.rolePochwala1Id);
        if (config.rolePochwala2Id) await safeRemoveRole(guild, targetUser.id, config.rolePochwala2Id);

        await db.insert(actionHistory).values({
          employeeId: emp.id,
          discordUserId: targetUser.id,
          actionType: "auto_promote",
          performedBy: "SYSTEM",
          performedByUsername: "SYSTEM",
          previousPosition: emp.position,
          newPosition: nextPos.name,
          details: "Automatyczny awans za 2/2 pochwały",
        });

        // DM about auto promote
        const promDmEmbed = new EmbedBuilder()
          .setTitle("🚀 Automatyczny Awans!")
          .setDescription(
            `Gratulacje **${targetUser.username}**!\n\n` +
              `Za zdobycie **2/2 pochwał** otrzymujesz automatyczny awans!\n\n` +
              `> 📤 **Poprzednie:** ${emp.position}\n` +
              `> 📥 **Nowe:** ${nextPos.name}\n\n` +
              `Tak trzymaj! 🎉`
          )
          .setColor(COLOR_PROMOTE)
          .setTimestamp();
        await sendDM(targetUser.id, promDmEmbed);

        // Log auto promote
        const autoPromEmbed = new EmbedBuilder()
          .setAuthor({ name: "🍔 BurgerShot HR • Automatyczny Awans" })
          .setTitle(`🚀 Automatyczny Awans`)
          .setDescription(
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `> 👤 **Pracownik:** <@${targetUser.id}> (${targetUser.username})\n` +
              `> 📤 **Poprzednie:** ${emp.position}\n` +
              `> 📥 **Nowe:** ${nextPos.name}\n` +
              `> 🏆 **Powód:** 2/2 Pochwały\n` +
              `> 📅 **Data:** ${formatDatePL(new Date())}`
          )
          .setColor(COLOR_PROMOTE)
          .setTimestamp();

        await sendLog(guild, config.channelAwanseDegradyId, autoPromEmbed);

        // Update employee position
        await db
          .update(employees)
          .set({
            position: nextPos.name,
            plusCount: newPlusCount,
            commendations: newCommendations,
            updatedAt: new Date(),
          })
          .where(eq(employees.id, emp.id));
      } else {
        // No higher position - just save
        await db
          .update(employees)
          .set({
            plusCount: newPlusCount,
            commendations: newCommendations,
            updatedAt: new Date(),
          })
          .where(eq(employees.id, emp.id));
      }
    } else {
      await db
        .update(employees)
        .set({
          plusCount: newPlusCount,
          commendations: newCommendations,
          updatedAt: new Date(),
        })
        .where(eq(employees.id, emp.id));
    }
  } else {
    // Just add plus, no commendation yet
    await updatePlusRoles(guild, targetUser.id, config, newPlusCount);
    await db
      .update(employees)
      .set({
        plusCount: newPlusCount,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, emp.id));
  }

  const stars = "⭐".repeat(Math.min(newPlusCount, threshold));
  const replyEmbed = new EmbedBuilder()
    .setTitle("➕ Plus Przyznany!")
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👤 **Otrzymał:** <@${targetUser.id}>\n` +
        `> 📜 **Powód:** ${reason}\n` +
        `> ${stars} **Stan:** ${newPlusCount}/${threshold} Plusów\n` +
        `> 🏆 **Pochwały:** ${newCommendations}/2\n` +
        `> 👮 **Przyznał:** <@${interaction.user.id}>` +
        (autoPromoted ? `\n\n🚀 **Automatyczny awans!**` : "")
    )
    .setColor(COLOR_PLUS)
    .setFooter({ text: "🍔 BurgerShot HR" })
    .setTimestamp();

  await interaction.reply({ embeds: [replyEmbed] });

  // Log to #plusy-minusy
  const logEmbed = new EmbedBuilder()
    .setAuthor({ name: "🍔 BurgerShot HR" })
    .setTitle(`➕ PLUS`)
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👮 **Przyznał:** <@${interaction.user.id}>\n` +
        `> 👤 **Otrzymał:** <@${targetUser.id}>\n` +
        `> 📜 **Powód:** ${reason}\n` +
        `> ${stars} **Stan:** ${newPlusCount}/${threshold} Plusów`
    )
    .setColor(COLOR_PLUS)
    .setTimestamp();

  await sendLog(guild, config.channelPlusyMinusyId, logEmbed);
}

// =================== MINUS ===================

async function handleMinus(interaction: any) {
  if (!(await checkPermission(interaction, "support"))) return;

  const targetUser = interaction.options.getUser("użytkownik");
  const reason = interaction.options.getString("powód");
  const guild = interaction.guild as Guild;
  const config = await getGuildConfig(guild.id);
  if (!config) {
    await interaction.reply({ content: "❌ Brak konfiguracji!", ephemeral: true });
    return;
  }

  const emps = await db
    .select()
    .from(employees)
    .where(and(eq(employees.discordUserId, targetUser.id), eq(employees.status, "active")));

  if (emps.length === 0) {
    await interaction.reply({ content: "❌ Ten użytkownik nie jest pracownikiem!", ephemeral: true });
    return;
  }

  const emp = emps[0];
  const threshold = config.minusesForReprimand;
  let newMinusCount = emp.minusCount + 1;
  let newReprimands = emp.reprimands;

  await db.insert(actionHistory).values({
    employeeId: emp.id,
    discordUserId: targetUser.id,
    actionType: "minus",
    performedBy: interaction.user.id,
    performedByUsername: interaction.user.username,
    reason,
    details: `Minus ${newMinusCount}/${threshold}`,
  });

  // Check if reached threshold for reprimand
  if (newMinusCount >= threshold) {
    newMinusCount = 0;
    newReprimands += 1;

    await db.insert(actionHistory).values({
      employeeId: emp.id,
      discordUserId: targetUser.id,
      actionType: "reprimand",
      performedBy: interaction.user.id,
      performedByUsername: interaction.user.username,
      details: `Nagana ${newReprimands}/2`,
    });

    await updateReprimandRoles(guild, targetUser.id, config, newReprimands);

    // Log reprimand
    const repEmbed = new EmbedBuilder()
      .setAuthor({ name: "🍔 BurgerShot HR • Nagana" })
      .setTitle(`⚠️ Nagana ${newReprimands}/2`)
      .setDescription(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `> 👤 **Pracownik:** <@${targetUser.id}> (${targetUser.username})\n` +
          `> ⚠️ **Nagany:** ${newReprimands}/2\n` +
          `> 📅 **Data:** ${formatDatePL(new Date())}\n\n` +
          `Pracownik zebrał ${threshold} minusów i otrzymał naganę!`
      )
      .setColor(COLOR_REPRIMAND)
      .setTimestamp();

    await sendLog(guild, config.channelPochwayNaganyId, repEmbed);

    // If 2/2 reprimands - notify management
    if (newReprimands >= 2) {
      const notifEmbed = new EmbedBuilder()
        .setTitle("🚨 UWAGA — 2/2 Nagany!")
        .setDescription(
          `Pracownik <@${targetUser.id}> (${targetUser.username}) otrzymał **2/2 nagany**!\n\n` +
            `Stanowisko: **${emp.position}**\n\n` +
            `⚠️ Pracownik powinien zostać degradowany lub zwolniony.\n` +
            `Użyj \`/degraduj\` lub \`/zwolnij\`.`
        )
        .setColor(COLOR_ERROR)
        .setTimestamp();

      await sendLog(guild, config.channelAwanseDegradyId, notifEmbed);
    }
  }

  await db
    .update(employees)
    .set({
      minusCount: newMinusCount,
      reprimands: newReprimands,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, emp.id));

  const replyEmbed = new EmbedBuilder()
    .setTitle("➖ Minus Przyznany")
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👤 **Otrzymał:** <@${targetUser.id}>\n` +
        `> 📜 **Powód:** ${reason}\n` +
        `> ❌ **Stan:** ${newMinusCount}/${threshold} Minusów\n` +
        `> ⚠️ **Nagany:** ${newReprimands}/2\n` +
        `> 👮 **Przyznał:** <@${interaction.user.id}>`
    )
    .setColor(COLOR_MINUS)
    .setFooter({ text: "🍔 BurgerShot HR" })
    .setTimestamp();

  await interaction.reply({ embeds: [replyEmbed] });

  // Log to #plusy-minusy
  const logEmbed = new EmbedBuilder()
    .setAuthor({ name: "🍔 BurgerShot HR" })
    .setTitle(`➖ MINUS`)
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👮 **Przyznał:** <@${interaction.user.id}>\n` +
        `> 👤 **Otrzymał:** <@${targetUser.id}>\n` +
        `> 📜 **Powód:** ${reason}\n` +
        `> ❌ **Stan:** ${newMinusCount}/${threshold} Minusów`
    )
    .setColor(COLOR_MINUS)
    .setTimestamp();

  await sendLog(guild, config.channelPlusyMinusyId, logEmbed);
}

// =================== KARTA PRACOWNIKA ===================

async function handleKarta(interaction: any) {
  if (!(await checkPermission(interaction, "support"))) return;

  const targetUser = interaction.options.getUser("użytkownik");
  const guild = interaction.guild as Guild;
  const config = await getGuildConfig(guild.id);

  // Find employee (all records including fired)
  const allEmps = await db
    .select()
    .from(employees)
    .where(eq(employees.discordUserId, targetUser.id))
    .orderBy(desc(employees.createdAt));

  if (allEmps.length === 0) {
    await interaction.reply({ content: "❌ Brak danych o tym użytkowniku!", ephemeral: true });
    return;
  }

  const activeEmp = allEmps.find((e) => e.status === "active");
  const emp = activeEmp || allEmps[0];

  // Get action history
  const history = await db
    .select()
    .from(actionHistory)
    .where(eq(actionHistory.discordUserId, targetUser.id))
    .orderBy(desc(actionHistory.createdAt));

  const hires = history.filter((h) => h.actionType === "hire");
  const fires = history.filter((h) => h.actionType === "fire");
  const promotions = history.filter((h) => h.actionType === "promote" || h.actionType === "auto_promote");
  const demotions = history.filter((h) => h.actionType === "demote");
  const pluses = history.filter((h) => h.actionType === "plus");
  const minuses = history.filter((h) => h.actionType === "minus");
  const commendations = history.filter((h) => h.actionType === "commendation");
  const reprimands = history.filter((h) => h.actionType === "reprimand");

  const threshold = config?.plusesForCommendation ?? 3;
  const minThreshold = config?.minusesForReprimand ?? 3;
  const plusStars = "⭐".repeat(Math.min(emp.plusCount, threshold));

  let historyText = "";
  const recentHistory = history.slice(0, 10);
  for (const h of recentHistory) {
    const date = formatDateShort(new Date(h.createdAt));
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
    const label = actionLabels[h.actionType] || h.actionType;
    historyText += `\`${date}\` ${label}`;
    if (h.reason) historyText += ` — *${h.reason}*`;
    if (h.performedByUsername && h.performedByUsername !== "SYSTEM") {
      historyText += ` (przez ${h.performedByUsername})`;
    }
    historyText += "\n";
  }
  if (history.length > 10) {
    historyText += `\n*...i ${history.length - 10} więcej wpisów*`;
  }

  const embed = new EmbedBuilder()
    .setAuthor({ name: "🍔 BurgerShot HR • Karta Pracownika" })
    .setTitle(`📄 ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL())
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👤 **Discord:** <@${targetUser.id}>\n` +
        `> 💼 **Stanowisko:** ${emp.position}\n` +
        `> 📊 **Status:** ${emp.status === "active" ? "✅ Aktywny" : "❌ Zwolniony"}\n` +
        `> 📅 **Zatrudniony:** ${formatDateShort(new Date(emp.hiredAt))}\n` +
        (emp.firedAt ? `> 📅 **Zwolniony:** ${formatDateShort(new Date(emp.firedAt))}\n` : "") +
        `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `**📊 Oceny:**\n` +
        `> ${plusStars || "—"} **Plusy:** ${emp.plusCount}/${threshold}\n` +
        `> ❌ **Minusy:** ${emp.minusCount}/${minThreshold}\n` +
        `> 🏆 **Pochwały:** ${emp.commendations}/2\n` +
        `> ⚠️ **Nagany:** ${emp.reprimands}/2\n` +
        `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `**📈 Statystyki:**\n` +
        `> Zatrudnienia: ${hires.length}\n` +
        `> Zwolnienia: ${fires.length}\n` +
        `> Awanse: ${promotions.length}\n` +
        `> Degradacje: ${demotions.length}\n` +
        `> Łączna liczba plusów: ${pluses.length}\n` +
        `> Łączna liczba minusów: ${minuses.length}\n` +
        `> Pochwały: ${commendations.length}\n` +
        `> Nagany: ${reprimands.length}\n` +
        `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `**📜 Ostatnia historia:**\n${historyText || "*Brak wpisów*"}`
    )
    .setColor(emp.status === "active" ? COLOR_PRIMARY : COLOR_ERROR)
    .setFooter({ text: `ID: ${emp.id}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// =================== PRACOWNIK (WYSZUKIWANIE) ===================

async function handlePracownik(interaction: any) {
  if (!(await checkPermission(interaction, "support"))) return;

  const targetUser = interaction.options.getUser("użytkownik");
  const guild = interaction.guild as Guild;
  const config = await getGuildConfig(guild.id);

  const emps = await db
    .select()
    .from(employees)
    .where(and(eq(employees.discordUserId, targetUser.id), eq(employees.status, "active")));

  if (emps.length === 0) {
    await interaction.reply({ content: "❌ Ten użytkownik nie jest aktywnym pracownikiem!", ephemeral: true });
    return;
  }

  const emp = emps[0];
  const threshold = config?.plusesForCommendation ?? 3;
  const minThreshold = config?.minusesForReprimand ?? 3;
  const plusStars = "⭐".repeat(Math.min(emp.plusCount, threshold));

  const embed = new EmbedBuilder()
    .setAuthor({ name: "🍔 BurgerShot HR • Informacje" })
    .setTitle(`🔍 ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL())
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👤 **Discord:** <@${targetUser.id}>\n` +
        `> 💼 **Stanowisko:** ${emp.position}\n` +
        `> 📅 **Zatrudniony:** ${formatDateShort(new Date(emp.hiredAt))}\n\n` +
        `> ${plusStars || "—"} **Plusy:** ${emp.plusCount}/${threshold}\n` +
        `> ❌ **Minusy:** ${emp.minusCount}/${minThreshold}\n` +
        `> 🏆 **Aktywne pochwały:** ${emp.commendations}/2\n` +
        `> ⚠️ **Aktywne nagany:** ${emp.reprimands}/2`
    )
    .setColor(COLOR_PRIMARY)
    .setFooter({ text: "🍔 BurgerShot HR" })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// =================== STATYSTYKI ===================

async function handleStatystyki(interaction: any) {
  if (!(await checkPermission(interaction, "support"))) return;

  const allHistory = await db.select().from(actionHistory);
  const activeEmps = await db
    .select()
    .from(employees)
    .where(eq(employees.status, "active"));
  const firedEmps = await db
    .select()
    .from(employees)
    .where(eq(employees.status, "fired"));

  const stats = {
    hired: allHistory.filter((h) => h.actionType === "hire").length,
    fired: allHistory.filter((h) => h.actionType === "fire").length,
    promoted: allHistory.filter((h) => h.actionType === "promote" || h.actionType === "auto_promote").length,
    demoted: allHistory.filter((h) => h.actionType === "demote").length,
    pluses: allHistory.filter((h) => h.actionType === "plus").length,
    minuses: allHistory.filter((h) => h.actionType === "minus").length,
    commendations: allHistory.filter((h) => h.actionType === "commendation").length,
    reprimands: allHistory.filter((h) => h.actionType === "reprimand").length,
  };

  const embed = new EmbedBuilder()
    .setAuthor({ name: "🍔 BurgerShot HR • Statystyki" })
    .setTitle("📊 Statystyki Burger Shot")
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `**👥 Pracownicy:**\n` +
        `> ✅ Aktywni: **${activeEmps.length}**\n` +
        `> ❌ Zwolnieni: **${firedEmps.length}**\n\n` +
        `**📈 Akcje:**\n` +
        `> 📥 Zatrudnienia: **${stats.hired}**\n` +
        `> ❌ Zwolnienia: **${stats.fired}**\n` +
        `> 📈 Awanse: **${stats.promoted}**\n` +
        `> 📉 Degradacje: **${stats.demoted}**\n\n` +
        `**⭐ Oceny:**\n` +
        `> ➕ Plusy: **${stats.pluses}**\n` +
        `> ➖ Minusy: **${stats.minuses}**\n` +
        `> 🏆 Pochwały: **${stats.commendations}**\n` +
        `> ⚠️ Nagany: **${stats.reprimands}**`
    )
    .setColor(COLOR_PRIMARY)
    .setFooter({ text: "🍔 BurgerShot HR" })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// =================== RANKING ===================

async function handleRanking(interaction: any) {
  if (!(await checkPermission(interaction, "support"))) return;

  const activeEmps = await db
    .select()
    .from(employees)
    .where(eq(employees.status, "active"));

  if (activeEmps.length === 0) {
    await interaction.reply({ content: "❌ Brak aktywnych pracowników!", ephemeral: true });
    return;
  }

  // Get all history for counting
  const allHistory = await db.select().from(actionHistory);

  const rankings = activeEmps.map((emp) => {
    const empHistory = allHistory.filter((h) => h.employeeId === emp.id);
    return {
      emp,
      totalPluses: empHistory.filter((h) => h.actionType === "plus").length,
      totalMinuses: empHistory.filter((h) => h.actionType === "minus").length,
      totalCommendations: empHistory.filter((h) => h.actionType === "commendation").length,
      totalPromotions: empHistory.filter(
        (h) => h.actionType === "promote" || h.actionType === "auto_promote"
      ).length,
    };
  });

  // Sort by pluses desc, then minuses asc
  rankings.sort((a, b) => {
    if (b.totalPluses !== a.totalPluses) return b.totalPluses - a.totalPluses;
    if (a.totalMinuses !== b.totalMinuses) return a.totalMinuses - b.totalMinuses;
    return b.totalCommendations - a.totalCommendations;
  });

  let rankText = "";
  const medals = ["🥇", "🥈", "🥉"];
  for (let i = 0; i < Math.min(rankings.length, 15); i++) {
    const r = rankings[i];
    const medal = i < 3 ? medals[i] : `**${i + 1}.**`;
    rankText +=
      `${medal} <@${r.emp.discordUserId}> — **${r.emp.position}**\n` +
      `> ➕ ${r.totalPluses} plusów | 🏆 ${r.totalCommendations} pochwał | ➖ ${r.totalMinuses} minusów | 📈 ${r.totalPromotions} awansów\n\n`;
  }

  const embed = new EmbedBuilder()
    .setAuthor({ name: "🍔 BurgerShot HR • Ranking" })
    .setTitle("🏆 Ranking Pracowników")
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${rankText}`
    )
    .setColor(COLOR_COMMENDATION)
    .setFooter({ text: `Łącznie ${activeEmps.length} aktywnych pracowników` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// =================== WYPOWIEDZENIE ===================

async function handleWypowiedzenie(interaction: any) {
  if (!(await checkPermission(interaction, "manager"))) return;

  const targetUser = interaction.options.getUser("kto");
  const reason = interaction.options.getString("powód");
  const guild = interaction.guild as Guild;
  const config = await getGuildConfig(guild.id);
  if (!config) {
    await interaction.reply({ content: "❌ Brak konfiguracji!", ephemeral: true });
    return;
  }

  const emps = await db
    .select()
    .from(employees)
    .where(and(eq(employees.discordUserId, targetUser.id), eq(employees.status, "active")));

  if (emps.length === 0) {
    await interaction.reply({ content: "❌ Ten użytkownik nie jest pracownikiem!", ephemeral: true });
    return;
  }

  const emp = emps[0];

  // Remove all BS roles
  await removeAllBsRoles(guild, targetUser.id, config);

  // Update DB - archive, don't delete
  await db
    .update(employees)
    .set({
      status: "resigned",
      firedAt: new Date(),
      firedBy: interaction.user.id,
      fireReason: reason,
      plusCount: 0,
      minusCount: 0,
      commendations: 0,
      reprimands: 0,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, emp.id));

  await db.insert(actionHistory).values({
    employeeId: emp.id,
    discordUserId: targetUser.id,
    actionType: "resignation",
    performedBy: interaction.user.id,
    performedByUsername: interaction.user.username,
    previousPosition: emp.position,
    reason,
  });

  const replyEmbed = new EmbedBuilder()
    .setTitle("📝 Wypowiedzenie / Zwolnienie")
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👤 **Kto:** <@${targetUser.id}>\n` +
        `> 📜 **Powód:** ${reason}\n` +
        `> 💼 **Ranga:** ${emp.position}\n` +
        `> 📅 **Data:** ${formatDatePL(new Date())}\n` +
        `> 👮 **Wykonał:** <@${interaction.user.id}>\n\n` +
        `✅ Usunięto wszystkie rangi Burger Shot\n` +
        `✅ Wyzerowano plusy, minusy, pochwały i nagany\n` +
        `✅ Dane zarchiwizowane`
    )
    .setColor(COLOR_FIRE)
    .setFooter({ text: "🍔 BurgerShot HR" })
    .setTimestamp();

  await interaction.reply({ embeds: [replyEmbed] });

  // Log
  const logEmbed = new EmbedBuilder()
    .setAuthor({ name: "🍔 BurgerShot HR • Wypowiedzenie" })
    .setTitle(`📝 Wypowiedzenie`)
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> 👤 **Kto:** <@${targetUser.id}> (${targetUser.username})\n` +
        `> 📜 **Powód:** ${reason}\n` +
        `> 💼 **Ranga:** ${emp.position}\n` +
        `> 👮 **Wykonał:** <@${interaction.user.id}>`
    )
    .setColor(COLOR_FIRE)
    .setTimestamp();

  await sendLog(guild, config.channelWypowiedzeniaId, logEmbed);
  await sendLog(guild, config.channelAwanseDegradyId, logEmbed);
}

// =================== INTERACTION HANDLER ===================

async function handleInteraction(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case "zatrudnij":
        await handleZatrudnij(interaction);
        break;
      case "awans":
        await handleAwans(interaction);
        break;
      case "degraduj":
        await handleDegraduj(interaction);
        break;
      case "zwolnij":
        await handleZwolnij(interaction);
        break;
      case "plus":
        await handlePlus(interaction);
        break;
      case "minus":
        await handleMinus(interaction);
        break;
      case "karta":
        await handleKarta(interaction);
        break;
      case "pracownik":
        await handlePracownik(interaction);
        break;
      case "statystyki":
        await handleStatystyki(interaction);
        break;
      case "ranking":
        await handleRanking(interaction);
        break;
      case "wypowiedzenie":
        await handleWypowiedzenie(interaction);
        break;
    }
  } catch (err) {
    console.error("[BOT] Command error:", err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: "❌ Wystąpił błąd. Spróbuj ponownie.", ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: "❌ Wystąpił błąd. Spróbuj ponownie.", ephemeral: true }).catch(() => {});
    }
  }
}

// =================== START / STOP ===================

export async function startBot(token: string) {
  if (client && client.isReady()) {
    return { success: true, message: "Bot już działa!" };
  }

  if (client) {
    client.destroy();
    client = null;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.on("ready", () => {
    console.log(`🍔 BurgerShot Manager Bot zalogowany jako ${client!.user!.tag}`);
  });

  client.on("error", (err: Error) => {
    console.error("[BOT] Error:", err.message);
  });

  client.on("interactionCreate", (i: Interaction) => void handleInteraction(i));

  try {
    console.log("[BOT] Logowanie...");
    await client.login(token);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timeout - bot nie odpowiada")),
        15000
      );
      client!.once("ready", () => {
        clearTimeout(timeout);
        resolve();
      });
      client!.once("error", (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Register slash commands
    const clientId = client.user!.id;
    await registerCommands(token, clientId);

    return { success: true, message: `Bot uruchomiony jako ${client.user?.tag}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[BOT] Błąd logowania:", msg);
    if (client) {
      client.destroy();
      client = null;
    }

    if (msg.includes("TOKEN_INVALID") || msg.includes("invalid token")) {
      return {
        success: false,
        message:
          "❌ Nieprawidłowy token! Sprawdź czy skopiowałeś cały token z Discord Developer Portal.",
      };
    }
    if (msg.includes("disallowed intents") || msg.includes("Disallowed Intents")) {
      return {
        success: false,
        message:
          "❌ Brak uprawnień Intents! Włącz 'Server Members Intent' i 'Message Content Intent' w Discord Developer Portal → Bot → Privileged Gateway Intents.",
      };
    }
    if (msg.includes("Timeout")) {
      return { success: false, message: "❌ Timeout - Discord nie odpowiada. Spróbuj ponownie." };
    }

    return { success: false, message: `❌ Błąd: ${msg}` };
  }
}

export async function stopBot() {
  if (client) {
    client.destroy();
    client = null;
  }
}
