import { NextRequest, NextResponse } from "next/server";
import { connectToPostgres } from "@/lib/postgres";
import { captureException, logger, motivo } from "@/lib/logger";
import { getConversationSummaryById } from "@/lib/repositories/conversationRepo";
import { DEMO_MODE, dbUnavailableResponse } from "@/lib/demo";
import { requireUserPermission } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }, // En Next.js 15+ params es asíncrono
) {
  const denied = await requireUserPermission(req, "read");
  if (denied) return denied;

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { success: false, error: "ID de conversación requerido" },
      { status: 400 },
    );
  }

  try {
    const db = await connectToPostgres();
    if (!db) {
      if (DEMO_MODE) {
        return NextResponse.json({
          success: true,
          source: "demo",
          data: { id, summary: "Resumen de prueba (Modo Demo)" },
        });
      }
      return dbUnavailableResponse();
    }

    const result = await getConversationSummaryById(db, id);

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Conversación no encontrada" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      source: "postgres",
      data: {
        id,
        summary: result.summary,
      },
    });
  } catch (error: any) {
    const errorId = captureException(error, {
      route: `/api/conversations/${id}/summary`,
      method: "GET",
    });
    logger.error("Error in GET /api/conversations/[id]/summary", {
      motivo: motivo(error),
      conversationId: id,
    });

    if (DEMO_MODE) {
      return NextResponse.json({
        success: true,
        source: "demo",
        data: { id, summary: "Resumen de prueba (Modo Demo)" },
      });
    }

    return NextResponse.json(
      { success: false, error: "No se pudo obtener el resumen", errorId },
      { status: 500 },
    );
  }
}
