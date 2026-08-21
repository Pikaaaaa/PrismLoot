import QRCode from "qrcode";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = url.searchParams.get("text")?.trim();
  if (!text || text.length > 256) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    const png = await QRCode.toBuffer(text, {
      type: "png",
      margin: 1,
      width: 168,
      color: { dark: "#0a0a0c", light: "#ffffff" },
    });
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "QR_FAILED" }, { status: 500 });
  }
}
