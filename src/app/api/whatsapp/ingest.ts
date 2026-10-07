import { NextRequest, NextResponse } from "next/server";
import { connectToPostgres } from "@/lib/postgres";
import { connectToDatabase, isDbConnected } from "@/lib/mongodb";
import { MessageModel } from "@/models/Message";
import { upsertContact } from "@/lib/repositories/contactRepo";
import {
  upsertConversation,
  bumpLastMessage,
} from "@/lib/repositories/conversationRepo";
import { normalizePhone } from "@/lib/whatsappService";
import { DEMO_MODE, dbUnavailableResponse } from "@/lib/demo";
import { captureException, logger, motivo } from "@/lib/logger";
import type { Contact, Conversation } from "@/types";
import { requireUserPermission } from "@/lib/auth";
import { formatTimeFromIso } from "@/lib/time";

// Logica compartida de recepcion de mensajes entrantes de WhatsApp.
//
// La consumen dos rutas:
//   - POST /api/whatsapp/incoming  (el navegador, con x-api-key)
//   - POST /api/whatsapp/webhook   (el servicio local de WhatsApp, server-to-server)
// Ambas garantizan que cada mensaje quede guardado como contacto + conversacion
// (Postgres) y como mensaje (MongoDB), para que aparezca en los chats recientes
// aunque el CRM se recargue o el navegador estuviera cerrado.

export type MediaType = "image" | "audio" | "video" | "document" | "sticker";

export interface MediaData {
  mimetype: string;
  data: string;
  size?: number;
  filename?: string | null;
  width?: number;
  height?: number;
}

export interface IncomingPayload {
  messageId?: string;
  from?: string;
  fromName?: string;
  timestamp?: number;
  text?: string;
  hasMedia?: boolean;
  mediaType?: MediaType;
  media?: MediaData;
  receivedAt?: string;
  // Campos adicionales para LIDs (Linked Identity de WhatsApp)
  isLid?: boolean;
  lidBase?: string;
  resolvedPhone?: string;
}

function sanitizeName(raw: string | undefined, fallback: string): string {
  const cleaned = String(raw ?? "")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[^a-zA-ZÀ-ÿ0-9\s'’-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
  return cleaned || fallback;
}

function displayTime(iso: string | undefined): string {
  return formatTimeFromIso(iso);
}

/** Contorno API completo de un contacto (con defaults) para la UI. */
function contactToApi(row: {
  id: string;
  name: string;
  handle: string;
  phone?: string | null;
  tags?: string[] | null;
  sentiment?: string | null;
  leadScore?: number | null;
  stage?: string | null;
  dealValue?: number | null;
  notes?: string | null;
  lastActive?: string | null;
  company?: string | null;
  avatarUrl?: string | null;
  avatar?: string;
}): Contact {
  return {
    id: row.id,
    name: row.name,
    avatar:
      row.avatarUrl ||
      row.avatar ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(row.name || row.id)}`,
    handle: row.handle,
    phone: row.phone ?? undefined,
    channel: "whatsapp",
    tags: Array.isArray(row.tags) ? row.tags : [],
    sentiment: "neutral",
    leadScore: row.leadScore ?? 50,
    stage: (row.stage as Contact["stage"]) ?? "lead",
    dealValue: row.dealValue ?? 0,
    notes: row.notes ?? "",
    lastActive: row.lastActive ?? "Ahora",
    company: row.company ?? undefined,
  };
}

/** Valida la credencial del navegador (x-api-key con write) o del webhook (?secret=). */
export async function authorizeIncoming(
  req: NextRequest,
): Promise<NextResponse | null> {
  const denied = await requireUserPermission(req, "write");
  if (!denied) return null;

  const secret =
    process.env.WHATSAPP_WEBHOOK_SECRET || process.env.API_MASTER_KEY;
  if (secret) {
    const provided = new URL(req.url).searchParams.get("secret");
    if (provided && String(provided) === secret) return null;
  }
  return denied;
}

/** Procesa un mensaje entrante y lo persiste (Postgres + MongoDB). */
export async function handleIncomingPayload(
  body: IncomingPayload,
): Promise<NextResponse> {
  try {
    const messageId = String(body.messageId || `m_inc_${Date.now()}`);
    const phone = normalizePhone(body.from || body.fromName || "");
    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Falta el numero del remitente" },
        { status: 400 },
      );
    }

    const name = sanitizeName(body.fromName, `Cliente ${phone}`);
    const text = String(body.text || "");
    const referralTag = detectReferralTag(text);
    const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date();
    const timestampLbl = displayTime(body.receivedAt);

    // Determinar el identificador único del contacto
    // Si es un LID, usar el lidBase como handle único
    // Si no, usar el phone normalizado
    const isLid = body.isLid || false;
    const lidBase = body.lidBase || null;
    const resolvedPhone = body.resolvedPhone || null;

    // El handle único del contacto: si es LID, guardar el JID completo (ej: "273404951326886@lid")
    // para que al enviar se detecte que es un LID y se use directamente
    const contactHandle = isLid && body.from ? body.from : phone;

    // El teléfono del contacto: si hay número resuelto, usarlo; si no, usar phone normalizado
    // Solo si el phone normalizado parece un número válido (10+ dígitos)
    const contactPhone = resolvedPhone || (phone.length >= 10 ? phone : null);

    const db = await connectToPostgres();
    if (!db) {
      if (DEMO_MODE) {
        return NextResponse.json({
          success: true,
          source: "demo",
          data: { incomingId: messageId, phone, name, text },
        });
      }
      return dbUnavailableResponse();
    }

    // 1. Contacto: reutilizar el existente por handle/telefono o crear nuevo.
    // Buscar por handle O por phone (si el phone parece un número válido)
    let contact: Parameters<typeof contactToApi>[0] | null = null;

    // Primero intentar buscar por handle exacto
    contact = await db.contact.findFirst({
      where: { handle: contactHandle },
    });

    // Si no se encontró por handle y tenemos un phone válido, buscar por phone
    if (!contact && contactPhone) {
      contact = await db.contact.findFirst({
        where: { phone: contactPhone },
      });
    }

    let isNewContact = false;
    if (!contact) {
      const initialTags = referralTag ? [referralTag] : [];

      // Crear nuevo contacto
      // Si es LID y no tenemos número resuelto, guardar el LID como handle
      // y dejar phone vacío (se actualizará cuando se resuelva el número)
      contact = await upsertContact(
        db,
        `c_wa_${phone}_${isLid ? "lid" : "num"}`,
        {
          name,
          handle: contactHandle,
          phone: contactPhone,
          channel: "whatsapp",
          sentiment: "neutral",
          leadScore: 50,
          stage: "lead",
          dealValue: 0,
          tags: initialTags,
          notes: isLid
            ? `Contacto creado desde WhatsApp (LID: ${lidBase}). El número real aún no se ha resuelto.`
            : "Contacto creado automaticamente desde WhatsApp.",
          lastActive: "Ahora",
          company: "",
        },
      );
      isNewContact = true;
      if (initialTags.length > 0) {
        try {
          const directUpdate = await db.contact.update({
            where: { id: contact.id },
            data: { tags: initialTags },
          });
          contact.tags = directUpdate.tags;
          console.log(
            `[TAGS][CONFIRM-NUEVO] Postgres guardó tags:`,
            directUpdate.tags,
          );
        } catch (dbErr: any) {
          console.error(
            `[TAGS][ERROR-NUEVO] Error guardando tags en DB:`,
            dbErr?.message,
          );
        }
      }
    } else {
      // Si el mensaje trae una referencia publicitaria y el contacto no la tiene, agrégala
      // Si el mensaje actual trae un Ref y el contacto aún no tiene ese tag
      if (referralTag) {
        const currentTags: string[] = Array.isArray(contact.tags)
          ? contact.tags
          : [];
        if (!currentTags.includes(referralTag)) {
          const updatedTags = [...currentTags, referralTag];
          console.log(
            `[TAGS][ACTUALIZANDO] Agregando ${referralTag}. Nuevos tags a persistir:`,
            updatedTags,
          );

          try {
            const updatedRow = await db.contact.update({
              where: { id: contact.id },
              data: { tags: updatedTags },
            });
            contact.tags = updatedRow.tags;
            console.log(
              `[TAGS][CONFIRM-EXISTENTE] Postgres guardó tags exitosamente:`,
              updatedRow.tags,
            );
          } catch (updateErr: any) {
            console.error(
              `[TAGS][ERROR-EXISTENTE] Error en db.contact.update de tags:`,
              updateErr?.message,
            );
          }
        } else {
          console.log(
            `[TAGS][OMITIDO] El contacto ya poseía el tag ${referralTag}. No requiere cambios.`,
          );
        }
      }

      // Actualizar phone si se resolvió
      if (!contact.phone && contactPhone) {
        await db.contact.update({
          where: { id: contact.id },
          data: { phone: contactPhone },
        });
        contact.phone = contactPhone;
      }

      // Actualizar handle LID
      if (isLid && contact.handle && !contact.handle.includes("@lid")) {
        await db.contact.update({
          where: { id: contact.id },
          data: { handle: contactHandle },
        });
        contact.handle = contactHandle;
      }
      if (!contact.handle && isLid && body.from) {
        await db.contact.update({
          where: { id: contact.id },
          data: { handle: contactHandle },
        });
        contact.handle = contactHandle;
      }
    }

    // 2. Conversacion: una por contacto en el canal whatsapp.
    let conversation: {
      id: string;
      contactId: string;
      channel: string;
      unreadCount: number;
      lastMessage: string;
      lastMessageTime: string;
      status: string;
      assignedAgent: string;
    } | null = await db.conversation.findFirst({
      where: { contactId: contact.id, channel: "whatsapp" },
      orderBy: { updatedAt: "desc" },
    });
    let isNewConversation = false;
    const mediaLabel = body.hasMedia ? getMediaLabel(body.mediaType) : "";
    const lastMsgText = text || mediaLabel || "[Mensaje]";
    if (!conversation) {
      conversation = await upsertConversation(
        db,
        `conv_wa_${phone}_${isLid ? "lid" : "num"}`,
        {
          contactId: contact.id,
          channel: "whatsapp",
          unreadCount: 0,
          lastMessage: lastMsgText,
          lastMessageTime: timestampLbl,
          status: "open",
          assignedAgent: "Asesor Whato",
        },
      );
      isNewConversation = true;
    }

    // 3. Actualizar el resumen de la conversacion (lastMessage + no leidos).
    await bumpLastMessage(db, conversation.id, {
      text: lastMsgText,
      sender: "contact",
    });

    // 4. Mensaje en MongoDB (upsert por id: el polling inicial y el socket
    // pueden entregar el mismo messageId dos veces).
    let mongoConnected = false;
    try {
      const mongo = await connectToDatabase();
      mongoConnected = !!mongo && isDbConnected();
    } catch {
      mongoConnected = false;
    }
    if (mongoConnected) {
      const updateFields: Record<string, any> = {
        hasMedia: body.hasMedia || false,
      };

      if (body.hasMedia && body.mediaType) {
        updateFields.mediaType = body.mediaType;
      }

      if (body.hasMedia && body.media) {
        updateFields.media = {
          mimetype: body.media.mimetype,
          data: body.media.data,
          size: body.media.size,
          filename: body.media.filename,
          width: body.media.width,
          height: body.media.height,
        };
      }

      await MessageModel.updateOne(
        { id: messageId },
        {
          $setOnInsert: {
            id: messageId,
            conversationId: conversation.id,
            sender: "contact",
            senderName: name,
            text,
            timestamp: timestampLbl,
            channel: "whatsapp",
            status: "read",
            createdAt: receivedAt,
          },
          $set: updateFields,
        },
        { upsert: true },
      );
    }

    const contactApi = contactToApi(contact);
    const conversationApi: Conversation = {
      id: conversation.id,
      contactId: conversation.contactId,
      contact: contactApi,
      channel: "whatsapp",
      unreadCount: (conversation.unreadCount || 0) + 1,
      lastMessage: lastMsgText,
      lastMessageTime: "Ahora",
      status: conversation.status as Conversation["status"],
      assignedAgent: conversation.assignedAgent,
    };

    return NextResponse.json({
      success: true,
      source: "postgres",
      data: {
        incomingId: messageId,
        contact: contactApi,
        conversation: conversationApi,
        message: {
          id: messageId,
          conversationId: conversation.id,
          sender: "contact",
          senderName: name,
          text,
          timestamp: timestampLbl,
          channel: "whatsapp",
          status: "read",
          hasMedia: body.hasMedia || false,
          mediaType: body.mediaType,
          media: body.media,
        },
        phone: isLid ? lidBase : phone,
        contactPhone,
        isLid,
        isNewContact,
        isNewConversation,
        messageSavedInMongo: mongoConnected,
      },
    });
  } catch (error: any) {
    const errorId = captureException(error, {
      route: "whatsapp/incoming",
      method: "POST",
    });
    logger.error("Error in whatsapp incoming", { motivo: motivo(error) });
    return NextResponse.json(
      { success: false, error: "Error interno del servidor", errorId },
      { status: 500 },
    );
  }
}

function getMediaLabel(mediaType?: string): string {
  switch (mediaType) {
    case "image":
      return "📷 Imagen";
    case "audio":
      return "🎵 Audio";
    case "video":
      return "🎬 Video";
    case "document":
      return "📄 Documento";
    case "sticker":
      return "🏷️ Sticker";
    default:
      return "📎 Archivo";
  }
}

function detectReferralTag(text: string | undefined): string | null {
  if (!text) return null;
  const match = text.match(/\[Ref:\s*([A-Za-z])/i);
  if (!match) return null;

  const prefix = match[1].toUpperCase();
  if (prefix === "F") return "Facebook Lead";
  if (prefix === "I") return "Instagram Lead";
  return null;
}

export { sanitizeName, displayTime };
