import { NextRequest, NextResponse } from 'next/server';
import { connectToPostgres } from '@/lib/postgres';
import { captureException } from '@/lib/logger';
import {
  listContacts,
  upsertContact,
  updateContact,
  deleteContact,
} from '@/lib/repositories/contactRepo';
import { INITIAL_CONTACTS } from '@/mockData';
import { DEMO_MODE, dbUnavailableResponse } from '@/lib/demo';
import { contactCreateSchema, contactUpdateSchema } from '@/lib/schemas';
import { logger, motivo } from '@/lib/logger';
import { requireUserPermission } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const denied = await requireUserPermission(req, 'read');
  if (denied) return denied;

  try {
    const db = await connectToPostgres();
    if (!db) {
      if (DEMO_MODE) {
        return NextResponse.json({ success: true, source: 'demo', data: INITIAL_CONTACTS });
      }
      return dbUnavailableResponse();
    }

    const { searchParams } = new URL(req.url);
    const contacts = await listContacts(db, {
      channel: searchParams.get('channel'),
      stage: searchParams.get('stage'),
    });

    if (contacts.length === 0 && DEMO_MODE) {
      return NextResponse.json({ success: true, source: 'demo', data: INITIAL_CONTACTS });
    }
    return NextResponse.json({ success: true, source: 'postgres', data: contacts });
  } catch (error: any) {
    const errorId = captureException(error, { route: '/api/contacts', method: 'GET' });
    logger.error('Error in GET /api/contacts', { motivo: motivo(error) });
    if (DEMO_MODE) {
      return NextResponse.json({ success: true, source: 'demo', data: INITIAL_CONTACTS });
    }
    return NextResponse.json(
      { success: false, error: 'No se pudieron obtener los contactos', errorId },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireUserPermission(req, 'write');
  if (denied) return denied;

  try {
    const body = await req.json();
    const parsed = contactCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Datos de contacto inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const db = await connectToPostgres();
    if (!db) {
      if (DEMO_MODE) {
        return NextResponse.json({ success: true, source: 'demo', data: parsed.data });
      }
      return dbUnavailableResponse();
    }

    const contactId = parsed.data.id || `c_${Date.now()}`;
    const saved = await upsertContact(db, contactId, parsed.data);
    return NextResponse.json({ success: true, source: 'postgres', data: saved });
  } catch (error: any) {
    const errorId = captureException(error, { route: '/api/contacts', method: 'POST' });
    logger.error('Error in POST /api/contacts', { motivo: motivo(error) });
    return NextResponse.json({ success: false, error: 'Error interno del servidor', errorId }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const denied = await requireUserPermission(req, 'write');
  if (denied) return denied;

  try {
    const body = await req.json();
    const parsed = contactUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Datos de contacto inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const db = await connectToPostgres();
    if (!db) {
      if (DEMO_MODE) {
        return NextResponse.json({ success: true, source: 'demo', data: parsed.data });
      }
      return dbUnavailableResponse();
    }

    const updated = await updateContact(db, parsed.data.id, parsed.data);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Contacto no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true, source: 'postgres', data: updated });
  } catch (error: any) {
    const errorId = captureException(error, { route: '/api/contacts', method: 'PUT' });
    logger.error('Error in PUT /api/contacts', { motivo: motivo(error) });
    return NextResponse.json({ success: false, error: 'Error interno del servidor', errorId }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireUserPermission(req, 'write');
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
    }

    const db = await connectToPostgres();
    if (!db) {
      if (DEMO_MODE) {
        return NextResponse.json({ success: true, message: 'Contacto eliminado (demo)' });
      }
      return dbUnavailableResponse();
    }
    await deleteContact(db, id);

    return NextResponse.json({ success: true, message: 'Contacto eliminado' });
  } catch (error: any) {
    const errorId = captureException(error, { route: '/api/contacts', method: 'DELETE' });
    logger.error('Error in DELETE /api/contacts', { motivo: motivo(error) });
    return NextResponse.json({ success: false, error: 'Error interno del servidor', errorId }, { status: 500 });
  }
}