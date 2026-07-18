import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { getBotStatus } = await import("@/bot");
    return NextResponse.json(getBotStatus());
  } catch {
    return NextResponse.json({ running: false, status: "not_initialized" });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, token } = body;

    if (action === "start") {
      if (!token) {
        return NextResponse.json({ success: false, message: "Token jest wymagany!" }, { status: 400 });
      }
      const { startBot } = await import("@/bot");
      const result = await startBot(token);
      return NextResponse.json(result);
    }

    if (action === "stop") {
      const { stopBot } = await import("@/bot");
      await stopBot();
      return NextResponse.json({ success: true, message: "Bot zatrzymany." });
    }

    return NextResponse.json({ success: false, message: "Nieznana akcja" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
