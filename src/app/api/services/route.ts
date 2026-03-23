import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "repairtrack-secret-key-2026";

function verifyToken(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  try { return jwt.verify(auth.replace("Bearer ", ""), JWT_SECRET) as any; } catch { return null; }
}

export async function GET() {
  try {
    const services = await prisma.service.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
    return NextResponse.json(services);
  } catch { return NextResponse.json([], { status: 500 }); }
}

export async function POST(req: Request) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const { name, price, icon } = await req.json();
    if (!name || price === undefined) return NextResponse.json({ error: "Nombre y precio requeridos" }, { status: 400 });
    const service = await prisma.service.create({ data: { name, price: parseFloat(price), icon: icon || "🔧" } });
    return NextResponse.json(service, { status: 201 });
  } catch { return NextResponse.json({ error: "Error al crear servicio" }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const { id, name, price, icon, active } = await req.json();
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(icon !== undefined && { icon }),
        ...(active !== undefined && { active }),
      },
    });
    return NextResponse.json(service);
  } catch { return NextResponse.json({ error: "Error al actualizar" }, { status: 500 }); }
}

export async function DELETE(req: Request) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const { id } = await req.json();
    await prisma.service.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Error al eliminar" }, { status: 500 }); }
}