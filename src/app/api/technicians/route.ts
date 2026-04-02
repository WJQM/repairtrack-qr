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

export async function GET(request: Request) {
  const user = getUserFromToken(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const technicians = await prisma.user.findMany({
    where: { role: "tech" },
    select: { id: true, name: true, email: true, phone: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(technicians);
}
