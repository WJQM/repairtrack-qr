import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "repairtrack-secret-key-2026";

function getUserFromToken(request: Request) {
  const auth = request.headers.get("Authorization");
  if (!auth) return null;
  try {
    const token = auth.replace("Bearer ", "");
    return jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
  } catch {
    return null;
  }
}

async function generateCode(): Promise<string> {
  const lastRepair = await prisma.repair.findFirst({
    where: { code: { startsWith: "OT-" } },
    orderBy: { createdAt: "desc" },
  });

  let nextNum = 1;
  if (lastRepair) {
    const match = lastRepair.code.match(/^OT-(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }

  const exists = await prisma.repair.findFirst({ where: { code: `OT-${nextNum}` } });
  if (exists) nextNum = nextNum + 1;

  return `OT-${nextNum}`;
}

export async function GET(request: Request) {
  const user = getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const repairs = await prisma.repair.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(repairs);
}

export async function POST(request: Request) {
  const user = getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const code = await generateCode();

    const repair = await prisma.repair.create({
      data: {
        code,
        device: body.device || "",
        brand: body.brand || null,
        model: body.model || null,
        issue: body.issue || "",
        priority: "media",
        estimatedCost: body.estimatedCost || 0,
        notes: body.notes || null,
        image: body.image || null,
        accessories: body.accessories || null,
        clientName: body.clientName || null,
        clientPhone: body.clientPhone || null,
        clientEmail: body.clientEmail || null,
        qrCode: code,
        userId: user.id,
      },
    });

    await prisma.notification.create({
      data: {
        type: "new_repair",
        title: "Nueva orden creada",
        message: `${repair.code} - ${repair.device} (${body.clientName || "Sin nombre"})`,
        userId: user.id,
      },
    });

    return NextResponse.json(repair);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}