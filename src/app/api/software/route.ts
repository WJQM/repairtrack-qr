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
    const items = await prisma.software.findMany({ where: { active: true }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(items);
  } catch { return NextResponse.json([], { status: 500 }); }
}

export async function POST(req: Request) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const { name, category, minRequirements, recRequirements, size, image } = await req.json();
    if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    const item = await prisma.software.create({
      data: { name, category: category || null, minRequirements: minRequirements || null, recRequirements: recRequirements || null, size: size || null, image: image || null },
    });
    return NextResponse.json(item, { status: 201 });
  } catch { return NextResponse.json({ error: "Error al crear" }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const { id, name, category, minRequirements, recRequirements, size, image, active } = await req.json();
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const item = await prisma.software.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(minRequirements !== undefined && { minRequirements }),
        ...(recRequirements !== undefined && { recRequirements }),
        ...(size !== undefined && { size }),
        ...(image !== undefined && { image }),
        ...(active !== undefined && { active }),
      },
    });
    return NextResponse.json(item);
  } catch { return NextResponse.json({ error: "Error al actualizar" }, { status: 500 }); }
}

export async function DELETE(req: Request) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const { id } = await req.json();
    await prisma.software.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Error al eliminar" }, { status: 500 }); }
}