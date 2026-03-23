import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  context: any
) {
  try {
    const { code } = await context.params;

    const repair = await prisma.repair.findFirst({
      where: {
        OR: [
          { code: code },
          { qrCode: code },
        ],
      },
    });

    if (!repair) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    return NextResponse.json(repair);
  } catch (error) {
    console.error("Track error:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
