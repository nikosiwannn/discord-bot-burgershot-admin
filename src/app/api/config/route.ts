import { NextResponse } from "next/server";
import { db } from "@/db";
import { guildConfig, positions } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const guildId = searchParams.get("guildId");

    if (!guildId) {
      return NextResponse.json({ error: "guildId required" }, { status: 400 });
    }

    const configs = await db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, guildId));

    const positionsList = await db
      .select()
      .from(positions)
      .where(eq(positions.guildId, guildId))
      .orderBy(asc(positions.level));

    return NextResponse.json({
      config: configs[0] ?? null,
      positions: positionsList,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { guildId, ...configData } = body;

    if (!guildId) {
      return NextResponse.json({ error: "guildId required" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, guildId));

    if (existing.length > 0) {
      await db
        .update(guildConfig)
        .set({
          ...configData,
          updatedAt: new Date(),
        })
        .where(eq(guildConfig.guildId, guildId));
    } else {
      await db.insert(guildConfig).values({
        guildId,
        ...configData,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
