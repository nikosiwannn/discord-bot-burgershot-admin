import { NextResponse } from "next/server";
import { db } from "@/db";
import { employees, actionHistory, positions } from "@/db/schema";
import { desc, asc } from "drizzle-orm";

export async function GET() {
  try {
    const allEmployees = await db
      .select()
      .from(employees)
      .orderBy(desc(employees.createdAt));

    const allHistory = await db
      .select()
      .from(actionHistory)
      .orderBy(desc(actionHistory.createdAt));

    const allPositions = await db
      .select()
      .from(positions)
      .orderBy(asc(positions.level));

    return NextResponse.json({
      employees: allEmployees,
      history: allHistory,
      positions: allPositions,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
