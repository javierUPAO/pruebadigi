/**
 * Cliente para el servicio de WhatsApp.
 *
 * El servicio es el canal real del chat del CRM:
 *   - Envio:   POST /api/whatsapp/send-message, /send-product-info, /send-campaign
 *   - Entrada: Socket.IO ('incoming-message', 'qr-update') + GET /received-messages
 *   - Estado:  GET /api/whatsapp/status
 *
 * Este modulo lo usan DOS consumidores con vistas distintas de la red, y esa
 * es la razon de que haya dos variables:
 *
 *   - El NAVEGADOR (page.tsx) necesita la URL publica del servicio, la que se
 *     alcanza desde internet: NEXT_PUBLIC_WHATSAPP_SERVICE_URL.
 *   - El SERVIDOR (el despacho de campanas, que envia sin que nadie mire)
 *     suele estar en la misma maquina o red que el servicio. Pedirle que salga
 *     a internet y vuelva a entrar por su propia IP publica falla en casi
 *     cualquier contenedor detras de un proxy: la peticion no llega ni a
 *     salir y el envio muere con «fetch failed».
 *
 * `WHATSAPP_SERVICE_URL` ya estaba DOCUMENTADA en .env.example como «se usa
 * en el servidor», pero ningun codigo la leia: era una variable fantasma. El
 * despacho de campanas usaba la publica, la unica que existia de verdad.
 * Resultado: el CRM mostraba WhatsApp conectado (cierto, desde el navegador)
 * mientras cada campana fallaba entera (tambien cierto, desde el servidor).
 */

/** Quita el "/" final para evitar URLs con doble barra (//api/...). */
const limpiar = (url: string) => url.replace(/\/+$/, "");

/**
 * URL interna, solo para codigo de servidor. Sin prefijo NEXT_PUBLIC_ a
 * proposito: no debe viajar al navegador (alli no significaria nada, y una
 * direccion interna en el bundle es informacion de infraestructura regalada).
 *
 * Valores tipicos: http://localhost:3001, http://127.0.0.1:3001 o el nombre
 * del servicio en Docker (http://whatsapp:3001).
 */
const URL_INTERNA =
  typeof window === "undefined" ? process.env.WHATSAPP_SERVICE_URL || "" : "";

/** URL publica: la que usa el navegador, y el respaldo del servidor. */
const URL_PUBLICA =
  process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL || "http://localhost:3001";

const SERVICE_URL = limpiar(URL_INTERNA || URL_PUBLICA);

export const WHATSAPP_SERVICE_URL = SERVICE_URL;

/** Elimina espacios, +, guiones y el sufijo @s.whatsapp.net: deja solo digitos.
 *  Si el input es un LID (@lid), retorna el identificador base sin el sufijo. */
export function normalizePhone(input: string): string {
  const cleaned = (input || "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@lid$/i, "")
    .replace(/\D+/g, "");
  return cleaned;
}

/** Verifica si un JID es un LID (Linked Identity) de WhatsApp */
export function isLid(input: string): boolean {
  return (input || "").includes("@lid");
}

/** Extrae el identificador base de un JID (antes del @) */
export function extractJidBase(jid: string): string {
  if (!jid) return "";
  return jid.split("@")[0];
}

/** Obtiene el remoteJid original para enviar un mensaje.
 *  Si es un LID, retorna el JID completo con @lid.
 *  Si es un número, retorna solo los dígitos. */
export function getJidForSending(input: string): string {
  if (isLid(input)) {
    // Si ya tiene @lid, retornarlo completo
    if (input.includes("@lid")) return input;
    // Si solo tiene los dígitos del LID, agregar @lid
    return `${input}@lid`;
  }
  // Es un número telefónico, retornar solo dígitos
  return normalizePhone(input);
}

export interface QrData {
  image: string;
  expiresAt: number;
  createdAt: string;
}

export interface WhatsappStatus {
  isConnected: boolean;
  hasActiveQR: boolean;
  qrData: QrData | null;
  connectionStatus: "connected" | "qr-ready" | "disconnected";
}

export type MediaType = "image" | "audio" | "video" | "document" | "sticker";

export interface MediaData {
  mimetype: string;
  data: string;
  size?: number;
  filename?: string | null;
  width?: number;
  height?: number;
}

export interface ReceivedWhatsAppMessage {
  messageId?: string;
  from?: string;
  fromName?: string;
  timestamp?: number;
  text?: string;
  hasMedia?: boolean;
  mediaType?: MediaType;
  media?: MediaData;
  receivedAt?: string;
}

export interface OutgoingWhatsAppMessage {
  messageId: string;
  jid: string;
  phone?: string;
  text: string;
  sender: "agent";
  senderName: string;
  channel: "whatsapp";
  status: string;
  timestamp: string;
}

export interface SendMediaOptions {
  phone: string;
  type: MediaType;
  media: string;
  caption?: string;
  filename?: string;
  mimetype?: string;
}

export interface ProductInfoOptions {
  productName: string;
  description?: string;
  email?: string;
  imageData: string;
  productoId?: number;
}

type AsService<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

type ServiceBody<T> = { success: boolean } & T;

type Req<T> = {
  ok: boolean;
  data: ServiceBody<T> | null;
  error?: string;
  status?: number;
};

/** Hace una peticion al servicio y nunca lanza: devuelve un resultado explicito. */
async function request<T>(path: string, init?: RequestInit): Promise<Req<T>> {
  try {
    const res = await fetch(`${SERVICE_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });

    const body = await res.json().catch(() => null);

    if (!res.ok || body?.success === false) {
      return {
        ok: false,
        data: null,
        status: res.status,
        error: body?.message || body?.error || `HTTP ${res.status}`,
      };
    }

    return { ok: true, data: body as ServiceBody<T> };
  } catch (err) {
    return {
      ok: false,
      data: null,
      status: 0,
      error:
        err instanceof Error
          ? err.message
          : "No se pudo conectar con el servicio de WhatsApp (" +
            SERVICE_URL +
            ")",
    };
  }
}

/** Quita la bandera `success` del cuerpo y expone solo el payload util. */
async function unwrap<T>(promise: Promise<Req<T>>): Promise<AsService<T>> {
  const r = await promise;
  if (r.ok && r.data) {
    const { success: _success, ...rest } = r.data;
    return { ok: true, data: rest as T };
  }
  return {
    ok: false,
    error: r.error || "Error desconocido del servicio",
    status: r.status || 0,
  };
}

/** GET /api/whatsapp/status */
export function getWhatsappStatus(): Promise<AsService<WhatsappStatus>> {
  return unwrap<WhatsappStatus>(
    request<WhatsappStatus>("/api/whatsapp/status"),
  );
}

/** POST /api/whatsapp/send-message (mensaje de texto generico). */
export function sendTextMessage(
  phone: string,
  message: string,
): Promise<AsService<{ messageId?: string; chatId?: string }>> {
  // Determinar si es un LID o un número telefónico
  const jidToSend = getJidForSending(phone);

  return unwrap<{ messageId?: string; chatId?: string }>(
    request<{ messageId?: string; chatId?: string }>(
      "/api/whatsapp/send-message",
      {
        method: "POST",
        body: JSON.stringify({ phone: jidToSend, message }),
      },
    ),
  );
}

/** POST /api/whatsapp/send-product-info (imagen + mensaje). */
export function sendProductInfo(
  phone: string,
  opts: ProductInfoOptions,
): Promise<AsService<{ messageId?: string; chatId?: string }>> {
  // Determinar si es un LID o un número telefónico
  const jidToSend = getJidForSending(phone);

  return unwrap<{ messageId?: string; chatId?: string }>(
    request<{ messageId?: string; chatId?: string }>(
      "/api/whatsapp/send-product-info",
      {
        method: "POST",
        body: JSON.stringify({
          phone: jidToSend,
          productName: opts.productName,
          description: opts.description || "",
          email: opts.email || "",
          imageData: opts.imageData,
          productoId: opts.productoId,
        }),
      },
    ),
  );
}

/** POST /api/whatsapp/send-media (envía imágenes, audios, videos, documentos y stickers). */
export function sendMediaMessage(
  opts: SendMediaOptions,
): Promise<
  AsService<{ messageId?: string; chatId?: string; timestamp?: number }>
> {
  const jidToSend = getJidForSending(opts.phone);

  return unwrap<{ messageId?: string; chatId?: string; timestamp?: number }>(
    request<{ messageId?: string; chatId?: string; timestamp?: number }>(
      "/api/whatsapp/send-media",
      {
        method: "POST",
        body: JSON.stringify({
          phone: jidToSend,
          type: opts.type,
          media: opts.media,
          caption: opts.caption,
          filename: opts.filename,
          mimetype: opts.mimetype,
        }),
      },
    ),
  );
}

/** GET /api/whatsapp/received-messages */
export function getReceivedMessages(
  limit = 50,
): Promise<AsService<{ messages: ReceivedWhatsAppMessage[]; total: number }>> {
  return unwrap<{ messages: ReceivedWhatsAppMessage[]; total: number }>(
    request<{ messages: ReceivedWhatsAppMessage[]; total: number }>(
      `/api/whatsapp/received-messages?limit=${limit}`,
    ),
  );
}

/** POST /api/whatsapp/webhook (registra el webhook del CRM en el servicio). */
export function registerWebhook(
  url: string,
): Promise<AsService<{ message?: string }>> {
  return unwrap<{ message?: string }>(
    request<{ message?: string }>("/api/whatsapp/webhook", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  );
}

/** POST /api/whatsapp/reset (reescanear QR). */
export function resetWhatsappSession(): Promise<
  AsService<{ message?: string }>
> {
  return unwrap<{ message?: string }>(
    request<{ message?: string }>("/api/whatsapp/reset", {
      method: "POST",
    }),
  );
}

export type { AsService };
