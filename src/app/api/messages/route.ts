import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, isDbConnected } from '@/lib/mongodb';
import { MessageModel } from '@/models/Message';
import { connectToPostgres } from '@/lib/postgres';
import { bumpLastMessage } from '@/lib/repositories/conversationRepo';
import { INITIAL_MESSAGES } from '@/mockData';
import { DEMO_MODE, dbUnavailableResponse } from '@/lib/demo';
import { captureException } from '@/lib/logger';
import { logger, motivo } from '@/lib/logger';
import { requireUserPermission } from '@/lib/auth';

// Los mensajes viven en MongoDB (alto volumen, append-only). La conversacion
// padre vive en Postgres: al insertar un mensaje se actualiza alli su resumen.

export async function GET(req: NextRequest) {
  const denied = await requireUserPermission(req, 'read');
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    const db = await connectToDatabase().catch(() => null);
    if (!db || !isDbConnected()) {
      if (DEMO_MODE) {
        if (conversationId && INITIAL_MESSAGES[conversationId]) {
          return NextResponse.json({ success: true, source: 'demo', data: INITIAL_MESSAGES[conversationId] });
        }
        return NextResponse.json({ success: true, source: 'demo', data: INITIAL_MESSAGES });
      }
      return dbUnavailableResponse();
    }

    if (conversationId) {
      const messages = await MessageModel.find({ conversationId }).sort({ createdAt: 1 }).lean();
      if ((!messages || messages.length === 0) && DEMO_MODE) {
        return NextResponse.json({
          success: true,
          source: 'demo',
          data: INITIAL_MESSAGES[conversationId] || [],
        });
      }
      return NextResponse.json({ success: true, source: 'mongodb', data: messages });
    }

    const allMessages = await MessageModel.find({}).sort({ createdAt: 1 }).lean();
    return NextResponse.json({ success: true, source: 'mongodb', data: allMessages });
  } catch (error: any) {
    const errorId = captureException(error, { route: '/api/messages', method: 'GET' });
    logger.error('Error in GET /api/messages', { motivo: motivo(error) });
    if (DEMO_MODE) {
      return NextResponse.json({ success: true, source: 'demo', data: INITIAL_MESSAGES });
    }
    return NextResponse.json(
      { success: false, error: 'No se pudieron obtener los mensajes', errorId },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireUserPermission(req, 'write');
  if (denied) return denied;

  try {
    const body = await req.json();
    const db = await connectToDatabase().catch(() => null);
    if (!db || !isDbConnected()) {
      if (DEMO_MODE) {
        return NextResponse.json({ success: true, source: 'demo', data: body });
      }
      return dbUnavailableResponse();
    }

    const msgId = body.id || `m_${Date.now()}`;
    const newMsg = await MessageModel.create({ ...body, id: msgId });

    // Actualiza la conversacion padre en Postgres (referencia blanda entre motores).
    if (body.conversationId) {
      const pg = await connectToPostgres();
      if (pg) {
        await bumpLastMessage(pg, body.conversationId, {
          text: body.text || '[Imagen adjunta]',
          sender: body.sender,
        });
      }
    }

    // NOTA: el envio real al canal lo hace el navegador contra el servicio
    // local de WhatsApp (REST + Socket.IO, ver src/lib/whatsappService.ts).
    // Esta ruta solo persiste el mensaje en MongoDB; si el envio falla, la UI
    // marca el mensaje como 'failed' con el resultado que devolvio el servicio.
    return NextResponse.json({
      success: true,
      source: 'mongodb',
      data: newMsg,
    });
  } catch (error: any) {
    const errorId = captureException(error, { route: '/api/messages', method: 'POST' });
    logger.error('Error in POST /api/messages', { motivo: motivo(error) });
    return NextResponse.json({ success: false, error: 'Error interno del servidor', errorId }, { status: 500 });
  }
}
