import { z } from 'zod';
import { parseScheduledAt } from '@/lib/time';
const ROLES = ['Administrador', 'Empleado'] as const

// Shared enums (must mirror src/types.ts and the Mongoose schemas)
const socialChannel = z.enum(['whatsapp', 'instagram', 'twitter', 'messenger', 'email']);
const leadSentiment = z.enum(['positive', 'neutral', 'urgent', 'churn_risk']);
const pipelineStage = z.enum(['lead', 'qualified', 'negotiation', 'closed_won', 'closed_lost']);
const conversationStatus = z.enum(['open', 'pending', 'resolved']);
const campaignStatus = z.enum([
  'draft',
  'scheduled',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);
const automationTrigger = z.enum(['message_received', 'lead_created', 'tag_added', 'stage_changed']);
const automationActionType = z.enum(['send_ai_reply', 'add_tag', 'change_stage', 'call_webhook', 'assign_agent']);


const contactInteractions = z
  .object({
    firstReply: z.boolean().optional(),
    appointmentConfirmed: z.boolean().optional(),
    proposalSent: z.boolean().optional(),
    dealClosed: z.boolean().optional(),
  })
  .strict();

const contactFields = {
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(50).regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'El nombre solo puede contener letras, espacios, guiones y apóstrofes'),
  avatar: z.string().optional(),
  handle: z.string().min(1),
  phone: z.string().max(20).regex(/^[\d\s+()-]*$/, 'El teléfono solo puede contener números, espacios y + ( ) -').optional(),
  email: z.string().email('Correo electrónico inválido').optional().or(z.literal('')),
  channel: socialChannel.optional(),
  tags: z.array(z.string()).optional(),
  sentiment: leadSentiment.optional(),
  leadScore: z.number().min(0).max(100).optional(),
  stage: pipelineStage.optional(),
  dealValue: z.number().optional(),
  notes: z.string().optional(),
  lastActive: z.string().optional(),
  location: z.string().optional(),
  company: z.string().optional(),
  customFields: z.record(z.string(), z.string()).optional(),
  interactions: contactInteractions.optional(),
};

export const contactCreateSchema = z.object(contactFields).strict();

export const contactUpdateSchema = z
  .object(contactFields)
  .partial()
  .extend({ id: z.string().min(1) })
  .strict();


const conversationFields = {
  id: z.string().min(1).optional(),
  contactId: z.string().min(1),
  channel: socialChannel.optional(),
  unreadCount: z.number().optional(),
  lastMessage: z.string().optional(),
  lastMessageTime: z.string().optional(),
  status: conversationStatus.optional(),
  assignedAgent: z.string().optional(),
  summary: z.string().optional(),
};

export const conversationCreateSchema = z.object(conversationFields).strict();

export const conversationUpdateSchema = z
  .object(conversationFields)
  .partial()
  .extend({ id: z.string().min(1) })
  .strict();

// ----- Campaign -----

// Las metricas (sentCount, deliveredCount, openRate, clickRate, conversions)
// NO se aceptan como entrada: se calculan en el servidor agregando la tabla de
// destinatarios. Si el cliente pudiera escribirlas, «enviados: 500» seria un
// numero inventado, que es justo lo que habia antes.
const campaignFields = {
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  channel: socialChannel.optional(),
  segmentId: z.string().min(1),
  segmentName: z.string().optional(),
  content: z.string().optional(),
  imageUrl: z.string().optional(),
  status: campaignStatus.optional(),
  scheduledDate: z.string().optional(),
  // Momento de lanzamiento. Se valida con el mismo interprete que usa el
  // servidor para convertirlo, de modo que lo que aqui se acepta es
  // exactamente lo que alli se entiende: una cadena que pasa esta validacion
  // nunca puede convertirse luego en una fecha distinta o invalida.
  //
  // `null` es un valor con significado propio: desprogramar la campana. Por
  // eso es nullable y no solo opcional — «no lo toques» (undefined) y
  // «quitalo» (null) son ordenes distintas.
  scheduledAt: z
    .string()
    .nullable()
    .optional()
    .refine((v) => v === null || v === undefined || parseScheduledAt(v) !== null, {
      message:
        'Fecha de programacion invalida. Usa "2026-09-25T14:30" (hora local del negocio) ' +
        'o un instante con zona explicita ("2026-09-25T19:30:00Z").',
    }),
  createdAt: z.string().optional(),
};

/**
 * Una campana en estado `scheduled` SIN fecha no se lanzaria jamas: el worker
 * busca por `scheduledAt`, asi que se quedaria esperando para siempre sin que
 * nadie lo notara. Es justo el fallo silencioso que estamos arreglando, y no
 * vamos a dejar abierta la puerta para volver a crearlo.
 */
const exigeFechaSiEstaProgramada = (datos: { status?: string; scheduledAt?: string | null }) =>
  datos.status !== 'scheduled' || !!datos.scheduledAt;

const MENSAJE_SIN_FECHA = {
  message: 'Una campana programada necesita fecha y hora de lanzamiento.',
  path: ['scheduledAt'],
};

export const campaignCreateSchema = z
  .object(campaignFields)
  .strict()
  .refine(exigeFechaSiEstaProgramada, MENSAJE_SIN_FECHA);

// En la actualizacion la comprobacion es mas floja a proposito: un PUT parcial
// puede traer `status: 'scheduled'` sin `scheduledAt` porque la fecha ya esta
// guardada de antes. Comparar contra lo que hay en la base es cosa del route
// handler, que es quien puede leerlo.
export const campaignUpdateSchema = z
  .object(campaignFields)
  .partial()
  .extend({ id: z.string().min(1) })
  .strict();

const automationAction = z
  .object({
    type: automationActionType,
    targetValue: z.string(),
  })
  .strict();

const automationFields = {
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  triggerEvent: automationTrigger,
  conditionChannel: socialChannel.optional(),
  conditionKeyword: z.string().optional(),
  actions: z.array(automationAction).optional(),
  enabled: z.boolean().optional(),
  triggerCount: z.number().optional(),
  lastTriggered: z.string().optional(),
};

export const automationCreateSchema = z.object(automationFields).strict();

export const automationUpdateSchema = z
  .object(automationFields)
  .partial()
  .extend({ id: z.string().min(1) })
  .strict();


const segmentFields = {
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  channels: z.array(socialChannel).optional(),
  minScore: z.number().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
  stages: z.array(pipelineStage).optional(),
  contactCount: z.number().optional(),
  createdAt: z.string().optional(),
};

export const segmentCreateSchema = z.object(segmentFields).strict();

export const segmentUpdateSchema = z
  .object(segmentFields)
  .partial()
  .extend({ id: z.string().min(1) })
  .strict();


// ----- Users -----
const userFields = {
  id: z.string().min(1).optional(),
   name: z.string({
    error: (issue) => issue.input === undefined ? 'Username is required' : 'Username must be a string'
  }).min(3).max(30).regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'El nombre solo puede contener letras, espacios, guiones y apóstrofes'),
  password: z.string({
    error: (issue) => issue.input === undefined ? 'Password is required' : 'Password must be a string'
  }).min(8),
  email: z.email({
    error: (issue) => issue.input === undefined ? 'Email is required' : 'This is not a valid email'
  }).max(254, 'Email is too long'),
  role: z.enum(ROLES),
  avatarUrl: z.string().max(30)
}

const userLoginFields = {
  password: z.string({
    error: (issue) => issue.input === undefined ? 'Password is required' : 'Password must be a string'
  }),
  email: z.email({
    error: (issue) => issue.input === undefined ? 'Email is required' : 'This is not a valid email'
  }),
}

  export const userCreateSchema = z.object(userFields).strict()
export const userLoginSchema = z.object(userLoginFields).strict()

export const userUpdateSchema = z
  .object(userFields)
  .partial()
  .extend({ id: z.string().min(3) })
  .strict()


// ----- Quick Reply -----

const quickReplyCategory = z.enum(['saludo', 'ventas', 'precios', 'soporte', 'general']);

const quickReplyFields = {
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  emoji: z.string().max(8).optional(),
  text: z.string().min(1),
  imageUrl: z.string().optional(),
  category: quickReplyCategory.optional(),
};

export const quickReplyCreateSchema = z.object(quickReplyFields).strict();

export const quickReplyUpdateSchema = z
  .object(quickReplyFields)
  .partial()
  .extend({ id: z.string().min(1) })
  .strict();

// ----- Preset Image -----
// Galeria compartida (Campanas + Respuestas Rapidas). `url` acepta tanto un
// link http(s) como un data URL base64 de una imagen subida por archivo, por
// eso no se valida con z.string().url().

const presetImageFields = {
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(120),
  url: z.string().min(1),
  type: z.string().min(1).max(60).optional(),
};

export const presetImageCreateSchema = z.object(presetImageFields).strict();

// ----- Tag -----

export const tagCreateSchema = z
  .object({
    name: z.string().min(1).max(60),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Color hex invalido (formato #rrggbb)')
      .optional(),
  })
  .strict();

const apiKeyPermission = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z_]+(:[a-z_]+)?$/, 'Permiso con formato invalido');

export const apiKeyCreateSchema = z
  .object({
    name: z.string().min(1).max(120),
    permissions: z.array(apiKeyPermission).min(1).max(20),
  })
  .strict();
