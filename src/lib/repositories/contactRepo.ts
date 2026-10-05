import type { PrismaClient, Prisma } from '../../generated/prisma/client';
import type { Contact } from '@/types';
import { resolveTagIds } from './tagRepo';

type ContactRow = Prisma.ContactGetPayload<{
  include: { contactTags: { include: { tag: true } }; interactions: true };
}>;

const withRelations = {
  contactTags: { include: { tag: true } },
  interactions: true,
} as const;

function toApiContact(row: ContactRow): Contact & { createdAt?: Date; updatedAt?: Date } {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatarUrl,
    handle: row.handle,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    channel: row.channel as Contact['channel'],
    tags: row.contactTags.map((ct) => ct.tag.name),
    sentiment: row.sentiment as Contact['sentiment'],
    leadScore: row.leadScore,
    stage: row.stage as Contact['stage'],
    dealValue: row.dealValue,
    notes: row.notes,
    lastActive: row.lastActive,
    location: row.location ?? undefined,
    company: row.company ?? undefined,
    customFields: (row.customFields as Record<string, string>) ?? {},
    interactions: row.interactions
      ? {
          firstReply: row.interactions.firstReply,
          appointmentConfirmed: row.interactions.appointmentConfirmed,
          proposalSent: row.interactions.proposalSent,
          dealClosed: row.interactions.dealClosed,
        }
      : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Campos escalares del contacto (sin tags ni interactions, que van a tablas aparte).
type ContactInput = Partial<Omit<Contact, 'tags' | 'interactions'>>;

function scalarData(input: ContactInput): Prisma.ContactUncheckedCreateInput | Prisma.ContactUpdateInput {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.avatar !== undefined) data.avatarUrl = input.avatar;
  if (input.handle !== undefined) data.handle = input.handle;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.email !== undefined) data.email = input.email;
  if (input.channel !== undefined) data.channel = input.channel;
  if (input.sentiment !== undefined) data.sentiment = input.sentiment;
  if (input.leadScore !== undefined) data.leadScore = input.leadScore;
  if (input.stage !== undefined) data.stage = input.stage;
  if (input.dealValue !== undefined) data.dealValue = input.dealValue;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.lastActive !== undefined) data.lastActive = input.lastActive;
  if (input.location !== undefined) data.location = input.location;
  if (input.company !== undefined) data.company = input.company;
  if (input.customFields !== undefined) data.customFields = input.customFields;
  return data as Prisma.ContactUncheckedCreateInput;
}

export async function listContacts(
  db: PrismaClient,
  filter: { channel?: string | null; stage?: string | null } = {}
): Promise<Contact[]> {
  const where: Prisma.ContactWhereInput = {};
  if (filter.channel && filter.channel !== 'all') where.channel = filter.channel;
  if (filter.stage && filter.stage !== 'all') where.stage = filter.stage;

  const rows = await db.contact.findMany({
    where,
    include: withRelations,
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map(toApiContact);
}

export async function getContact(db: PrismaClient, id: string): Promise<Contact | null> {
  const row = await db.contact.findUnique({ where: { id }, include: withRelations });
  return row ? toApiContact(row) : null;
}

async function syncTags(db: PrismaClient, contactId: string, tags: string[]): Promise<void> {
  const tagIds = await resolveTagIds(db, tags);
  await db.contactTag.deleteMany({
    where: { contactId, tagId: { notIn: tagIds.length ? tagIds : ['__none__'] } },
  });
  for (const tagId of tagIds) {
    await db.contactTag.upsert({
      where: { contactId_tagId: { contactId, tagId } },
      update: {},
      create: { contactId, tagId },
    });
  }
}

async function syncInteractions(
  db: PrismaClient,
  contactId: string,
  interactions: Contact['interactions']
): Promise<void> {
  if (!interactions) return;
  const data = {
    firstReply: interactions.firstReply ?? false,
    appointmentConfirmed: interactions.appointmentConfirmed ?? false,
    proposalSent: interactions.proposalSent ?? false,
    dealClosed: interactions.dealClosed ?? false,
  };
  await db.contactInteraction.upsert({
    where: { contactId },
    update: data,
    create: { contactId, ...data },
  });
}

/** POST: crea o reemplaza un contacto por id (equivalente al upsert de Mongoose). */
export async function upsertContact(
  db: PrismaClient,
  id: string,
  input: ContactInput & { tags?: string[]; interactions?: Contact['interactions'] }
): Promise<Contact> {
  const scalar = scalarData(input);
  await db.contact.upsert({
    where: { id },
    update: scalar as Prisma.ContactUpdateInput,
    create: { ...(scalar as Prisma.ContactUncheckedCreateInput), id, handle: input.handle ?? id, name: input.name ?? id },
  });

  if (input.tags !== undefined) await syncTags(db, id, input.tags);
  await syncInteractions(db, id, input.interactions);

  const row = await db.contact.findUnique({ where: { id }, include: withRelations });
  return toApiContact(row as ContactRow);
}

/** PUT: actualiza parcialmente un contacto existente. */
export async function updateContact(
  db: PrismaClient,
  id: string,
  input: ContactInput & { tags?: string[]; interactions?: Contact['interactions'] }
): Promise<Contact | null> {
  const exists = await db.contact.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return null;

  await db.contact.update({ where: { id }, data: scalarData(input) as Prisma.ContactUpdateInput });
  if (input.tags !== undefined) await syncTags(db, id, input.tags);
  if (input.interactions !== undefined) await syncInteractions(db, id, input.interactions);

  const row = await db.contact.findUnique({ where: { id }, include: withRelations });
  return toApiContact(row as ContactRow);
}

/** DELETE: la cascada (contact_tags, contact_interactions, conversations,
 *  appointments) la aplica Postgres via onDelete: Cascade. */
export async function deleteContact(db: PrismaClient, id: string): Promise<void> {
  await db.contact.delete({ where: { id } }).catch(() => null);
}
