import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "repairtrack-secret-key-2026";

function getUserFromToken(request: Request) {
  const auth = request.headers.get("Authorization");
  if (!auth) return null;
  try {
    const token = auth.replace("Bearer ", "");
    return jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: string;
    };
  } catch {
    return null;
  }
}

// GET - Obtener mensajes de una reparación
export async function GET(request: Request) {
  const user = getUserFromToken(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const repairId = searchParams.get("repairId");

  if (!repairId) {
    return NextResponse.json(
      { error: "repairId es requerido" },
      { status: 400 }
    );
  }

  const messages = await prisma.message.findMany({
    where: { repairId },
    include: {
      user: {
        select: { id: true, name: true, role: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(messages);
}

// POST - Enviar mensaje
export async function POST(request: Request) {
  const user = getUserFromToken(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { repairId, text } = await request.json();

    if (!repairId || !text) {
      return NextResponse.json(
        { error: "repairId y text son requeridos" },
        { status: 400 }
      );
    }

    const message = await prisma.message.create({
      data: {
        text,
        repairId,
        userId: user.id,
      },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    return NextResponse.json(message);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al enviar mensaje" },
      { status: 500 }
    );
  }
}