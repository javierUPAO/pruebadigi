import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase, isDbConnected } from "@/lib/mongodb";
import { MessageModel } from "@/models/Message";
import { connectToPostgres } from "@/lib/postgres";
import {
  bumpLastMessage,
  upsertConversation,
} from "@/lib/repositories/conversationRepo";
import { upsertContact } from "@/lib/repositories/contactRepo";
import { normalizePhone } from "@/lib/whatsappService";
import { captureException, logger, motivo } from "@/lib/logger";

interface OutgoingPayload {
  jid?: string;
  phone?: string | null;
  messageId?: string;
  message?: string;
  text?: string;
  timestamp?: number | string;
  sender?: string;
  senderName?: string;
  channel?: string;
  source?: string;
  status?: string;
}

function authorizeInternalRequest(req: NextRequest): boolean {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;

  if (!secret) {
    return false;
  }

  const provided =
    req.headers.get("x-api-key") || req.headers.get("x-whatsapp-secret");

  return provided === secret;
}

export async function POST(req: NextRequest) {
  try {
    /*
     * Este endpoint es llamado por el servicio WhatsApp (:3001).
     */
    if (!authorizeInternalRequest(req)) {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado",
        },
        { status: 401 },
      );
    }

    const body: OutgoingPayload = await req.json();

    const jid = String(body.jid || "").trim();

    const phone = body.phone ? normalizePhone(String(body.phone)) : "";

    const text = String(body.text || body.message || "").trim();

    if (!jid && !phone) {
      return NextResponse.json(
        {
          success: false,
          error: "Se requiere jid o phone",
        },
        { status: 400 },
      );
    }

    if (!text) {
      return NextResponse.json(
        {
          success: false,
          error: "El mensaje está vacío",
        },
        { status: 400 },
      );
    }

    const messageId =
      String(body.messageId || "").trim() || `m_wa_out_${Date.now()}`;

    const sender = body.sender || "agent";
    const senderName = body.senderName || "Xiomara";
    const channel = body.channel || "whatsapp";
    const status = body.status || "sent";

    /*
     * ============================================================
     * 1. POSTGRESQL
     * ============================================================
     */

    const pg = await connectToPostgres();

    if (!pg) {
      return NextResponse.json(
        {
          success: false,
          error: "No se pudo conectar a PostgreSQL",
        },
        { status: 503 },
      );
    }

    /*
     * ------------------------------------------------------------
     * Buscar contacto por JID
     * ------------------------------------------------------------
     */

    let contact = null;

    if (jid) {
      contact = await pg.contact.findFirst({
        where: {
          handle: jid,
        },
      });
    }

    /*
     * ------------------------------------------------------------
     * Si no existe por JID, buscar por teléfono
     * ------------------------------------------------------------
     */

    if (!contact && phone) {
      contact = await pg.contact.findFirst({
        where: {
          phone,
        },
      });
    }

    /*
     * ------------------------------------------------------------
     * Si no existe, crear contacto
     * ------------------------------------------------------------
     */

    if (!contact) {
      const contactHandle =
        jid || (phone ? `${phone}@s.whatsapp.net` : `wa:${Date.now()}`);

      const contactId = `c_wa_${jid || phone || Date.now()}`;

      contact = await upsertContact(pg, contactId, {
        name: senderName,
        handle: contactHandle,
        phone: phone || null,
        channel: "whatsapp",
        sentiment: "neutral",
        leadScore: 50,
        stage: "lead",
        dealValue: 0,
        notes: "Contacto creado desde mensaje saliente de WhatsApp.",
        lastActive: "Ahora",
        company: "",
      });
    }

    /*
     * ============================================================
     * 2. CONVERSACIÓN
     * ============================================================
     *
     * IMPORTANTE:
     * Trabajamos solamente con conversationId.
     * Así evitamos mezclar el tipo Prisma Conversation
     * con ApiConversation.
     */

    let conversationId: string;
    let isNewConversation = false;

    const existingConversation = await pg.conversation.findFirst({
      where: {
        contactId: contact.id,
        channel: "whatsapp",
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (existingConversation) {
      conversationId = existingConversation.id;
    } else {
      const base = jid?.split("@")[0] || phone || String(contact.id);

      const isLid = jid?.endsWith("@lid");

      const newConversation = await upsertConversation(
        pg,
        `conv_wa_${base}_${isLid ? "lid" : "num"}`,
        {
          contactId: contact.id,
          channel: "whatsapp",
          unreadCount: 0,
          lastMessage: text,
          lastMessageTime: "Ahora",
          status: "open",
          assignedAgent: "Asesor Whato",
        },
      );

      conversationId = newConversation.id;
      isNewConversation = true;
    }

    /*
     * El mensaje salió del agente/Xiomara.
     * No incrementa unreadCount.
     */
    await bumpLastMessage(pg, conversationId, {
      text,
      sender,
    });

    /*
     * ============================================================
     * 3. MONGODB
     * ============================================================
     */

    const mongo = await connectToDatabase().catch(() => null);

    if (!mongo || !isDbConnected()) {
      return NextResponse.json(
        {
          success: false,
          error: "PostgreSQL actualizado, pero MongoDB no está disponible",
          conversationId,
        },
        { status: 503 },
      );
    }

    const timestamp =
      body.timestamp ||
      new Date().toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

    /*
     * Usamos upsert para evitar duplicados si el mismo
     * messageId llega nuevamente.
     */
    const mongoResult = await MessageModel.updateOne(
      {
        id: messageId,
      },
      {
        $set: {
          conversationId,
          sender,
          senderName,
          text,
          timestamp,
          channel,
          status,
          jid,
          phone: phone || null,
          source: body.source || "whatsapp-service",
        },
        $setOnInsert: {
          id: messageId,
        },
      },
      {
        upsert: true,
      },
    );

    /*
     * ============================================================
     * 4. RESPUESTA
     * ============================================================
     */

    return NextResponse.json({
      success: true,
      source: "whatsapp-outgoing",
      data: {
        messageId,
        conversationId,
        contactId: contact.id,
        jid,
        phone: phone || null,
        text,
        sender,
        senderName,
        status,
        isNewConversation,
        alreadyExisted:
          mongoResult.matchedCount > 0 && mongoResult.upsertedCount === 0,
      },
    });
  } catch (error: any) {
    const errorId = captureException(error, {
      route: "/api/whatsapp/outgoing",
      method: "POST",
    });

    logger.error("Error en POST /api/whatsapp/outgoing", {
      motivo: motivo(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor",
        errorId,
      },
      { status: 500 },
    );
  }
}
