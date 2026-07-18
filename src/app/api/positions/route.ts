import { NextResponse } from "next/server";
import { db } from "@/db";
import { positions } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const guildId = searchParams.get("guildId");

    if (!guildId) {
      return NextResponse.json({ error: "guildId required" }, { status: 400 });
    }

    const positionsList = await db
      .select()
      .from(positions)
      .where(eq(positions.guildId, guildId))
      .orderBy(asc(positions.level));

    return NextResponse.json({ positions: positionsList });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { guildId, name, roleId, level } = body;

    if (!guildId || !name || !roleId || level === undefined) {
      return NextResponse.json(
        { error: "guildId, name, roleId and level are required" },
        { status: 400 }
      );
    }

    await db.insert(positions).values({
      guildId,
      name,
      roleId,
      level,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const guildId = searchParams.get("guildId");

    if (!id || !guildId) {
      return NextResponse.json({ error: "id and guildId required" }, { status: 400 });
    }

    await db
      .delete(positions)
      .where(and(eq(positions.id, parseInt(id)), eq(positions.guildId, guildId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
