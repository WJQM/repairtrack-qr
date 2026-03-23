import { writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.name)}`;
    const uploadPath = path.join(process.cwd(), "public", "uploads", uniqueName);

    await writeFile(uploadPath, buffer);

    return NextResponse.json({ url: `/uploads/${uniqueName}` });
  } catch (error) {
    return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 });
  }
}