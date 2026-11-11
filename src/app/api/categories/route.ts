import { NextRequest, NextResponse } from "next/server";
import { connectToPostgres } from "@/lib/postgres";
import { dbUnavailableResponse } from "@/lib/demo";
import { captureException, logger, motivo } from "@/lib/logger";
import { requireUserPermission } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const denied = await requireUserPermission(req, "read");
  if (denied) return denied;

  try {
    const pg = await connectToPostgres();
    if (!pg) return dbUnavailableResponse();

    const { searchParams } = new URL(req.url);
    const tipoParam = searchParams.get("tipo");
    const padreIdParam = searchParams.get("padre_id");

    // Filtro opcional (ej: ?tipo=1 para cargar el select de padres)
    if (tipoParam !== null) {
      const whereClause: any = { tipo: Number(tipoParam) };
      if (padreIdParam !== null) {
        whereClause.padre_id = Number(padreIdParam);
      }

      const items = await pg.category.findMany({
        where: whereClause,
        include: {
          subcategorias: {
            orderBy: { nombre: "asc" },
          },
        },
        orderBy: { nombre: "asc" },
      });

      return NextResponse.json({
        success: true,
        data: items,
      });
    }

    // Por defecto: devuelve todas las categorías principales con sus subcategorías anidadas
    const categorias = await pg.category.findMany({
      where: { tipo: 1 },
      include: {
        subcategorias: {
          orderBy: { nombre: "asc" },
        },
      },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: categorias,
    });
  } catch (error: any) {
    const errorId = captureException(error, {
      route: "/api/categories",
      method: "GET",
    });
    logger.error("Error in GET /api/categories", { motivo: motivo(error) });
    return NextResponse.json(
      {
        success: false,
        error: "No se pudieron obtener las categorías",
        errorId,
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireUserPermission(req, "write");
  if (denied) return denied;

  try {
    const pg = await connectToPostgres();
    if (!pg) return dbUnavailableResponse();

    const body = await req.json();
    const nombreLimpio = String(body.nombre || "").trim();
    const tipo = Number(body.tipo); // 1 = Categoría, 0 = Subcategoría
    const padre_id = tipo === 0 && body.padre_id ? Number(body.padre_id) : null;

    if (!nombreLimpio) {
      return NextResponse.json(
        { success: false, error: "El nombre es obligatorio." },
        { status: 400 },
      );
    }

    if (tipo === 0 && !padre_id) {
      return NextResponse.json(
        { success: false, error: "Debes seleccionar una categoría padre." },
        { status: 400 },
      );
    }

    // Validar duplicado (case-insensitive) dentro del mismo tipo
    const existente = await pg.category.findFirst({
      where: {
        tipo,
        nombre: {
          equals: nombreLimpio,
          mode: "insensitive",
        },
      },
    });

    if (existente) {
      const etiqueta = tipo === 1 ? "categoría" : "subcategoría";
      return NextResponse.json(
        {
          success: false,
          error: `Ya existe una ${etiqueta} con este nombre "${nombreLimpio}"`,
        },
        { status: 409 },
      );
    }

    const nueva = await pg.category.create({
      data: {
        nombre: nombreLimpio,
        tipo,
        padre_id,
      },
    });

    const etiquetaExito = tipo === 1 ? "categoría" : "subcategoría";
    return NextResponse.json({
      success: true,
      message: `Se ha creado la ${etiquetaExito} "${nueva.nombre}" correctamente.`,
      data: nueva,
    });
  } catch (error: any) {
    const errorId = captureException(error, {
      route: "/api/categories",
      method: "POST",
    });
    logger.error("Error in POST /api/categories", { motivo: motivo(error) });
    return NextResponse.json(
      { success: false, error: "Error interno al crear el registro", errorId },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const denied = await requireUserPermission(req, "write");
  if (denied) return denied;

  try {
    const pg = await connectToPostgres();
    if (!pg) return dbUnavailableResponse();

    const body = await req.json();
    const id_categoria = Number(body.id_categoria);
    const nombreLimpio = String(body.nombre || "").trim();
    const tipo = Number(body.tipo);
    const padre_id = tipo === 0 && body.padre_id ? Number(body.padre_id) : null;

    if (!id_categoria || !nombreLimpio) {
      return NextResponse.json(
        { success: false, error: "ID y nombre son obligatorios." },
        { status: 400 },
      );
    }

    if (tipo === 0 && !padre_id) {
      return NextResponse.json(
        { success: false, error: "Debes seleccionar una categoría padre." },
        { status: 400 },
      );
    }

    // Validar que no exista otro registro del mismo tipo con el mismo nombre (excluyendo el actual)
    const duplicado = await pg.category.findFirst({
      where: {
        tipo,
        nombre: {
          equals: nombreLimpio,
          mode: "insensitive",
        },
        NOT: {
          id_categoria,
        },
      },
    });

    if (duplicado) {
      const etiqueta = tipo === 1 ? "categoría" : "subcategoría";
      return NextResponse.json(
        {
          success: false,
          error: `Ya existe una ${etiqueta} con este nombre "${nombreLimpio}"`,
        },
        { status: 409 },
      );
    }

    const actualizada = await pg.category.update({
      where: { id_categoria },
      data: {
        nombre: nombreLimpio,
        ...(tipo === 0 ? { padre_id } : { padre_id: null }),
      },
    });

    const etiquetaExito = tipo === 1 ? "categoría" : "subcategoría";
    return NextResponse.json({
      success: true,
      message: `Se ha modificado la ${etiquetaExito} "${actualizada.nombre}" correctamente.`,
      data: actualizada,
    });
  } catch (error: any) {
    const errorId = captureException(error, {
      route: "/api/categories",
      method: "PUT",
    });
    logger.error("Error in PUT /api/categories", { motivo: motivo(error) });
    return NextResponse.json(
      {
        success: false,
        error: "Error interno al modificar el registro",
        errorId,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireUserPermission(req, "write");
  if (denied) return denied;

  try {
    const pg = await connectToPostgres();
    if (!pg) return dbUnavailableResponse();

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");

    if (!idParam) {
      return NextResponse.json(
        { success: false, error: "Se requiere el ID de la categoría" },
        { status: 400 },
      );
    }

    const id_categoria = Number(idParam);

    const existente = await pg.category.findUnique({
      where: { id_categoria },
    });

    if (!existente) {
      return NextResponse.json(
        { success: false, error: "El registro ya no existe." },
        { status: 404 },
      );
    }

    await pg.category.delete({
      where: { id_categoria },
    });

    const etiquetaExito = existente.tipo === 1 ? "categoría" : "subcategoría";
    return NextResponse.json({
      success: true,
      message: `Se ha eliminado la ${etiquetaExito} "${existente.nombre}" correctamente.`,
      deletedId: id_categoria,
    });
  } catch (error: any) {
    const errorId = captureException(error, {
      route: "/api/categories",
      method: "DELETE",
    });
    logger.error("Error in DELETE /api/categories", { motivo: motivo(error) });
    return NextResponse.json(
      {
        success: false,
        error: "Error interno al eliminar el registro",
        errorId,
      },
      { status: 500 },
    );
  }
}
