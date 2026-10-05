import { NextRequest, NextResponse } from 'next/server';
import { connectToPostgres } from '@/lib/postgres';
import { hashApiKey } from '@/lib/apiKeySecurity';
import { jwtVerify } from 'jose';

// 'delete' es un permiso INDEPENDIENTE y explicito: no lo otorga 'write'.
// Una credencial pensada para editar contenido no debe poder borrar entidades.
// Solo lo satisfacen 'delete', un scope prefijado ('delete:campaigns', ...) o
// un alias de administrador.
export type Permission = 'read' | 'write' | 'delete' | 'admin';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  Administrador: ['admin'],
  Empleado: ['read', 'write']
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET)


export function extractApiKey(req: NextRequest): string | null {
  // const header = req.headers.get('x-api-key');
  // if (header) return header;

  // const authorization = req.headers.get('authorization') || '';
  // const bearer = authorization.match(/^Bearer\s+(.+)$/i);
  // return bearer?.[1] || null;

  const userId = req.headers.get('x-verified-user-id')
  if (!userId) return null
  return userId

}

export function hasPermission(
  // permissions: string[], required: Permission
  role: string | null | undefined, required: Permission
): boolean {
  // const ADMIN_ALIASES = ['Administrador', 'admin:all', 'full_access'];
  // if (permissions.some((p) => ADMIN_ALIASES.includes(p))) return true;
  // return permissions.some((p) => p === required || p.startsWith(required + ':'));

  if (!role) return false;
  const granted = ROLE_PERMISSIONS[role]
  if (!granted) return false;
  return granted.includes(required) || granted.includes('admin')
}

export function hasPermissions(
  permissions: string[], required: Permission
): boolean {
  const ADMIN_ALIASES = ['Administrador', 'admin:all', 'full_access'];
  if (permissions.some((p) => ADMIN_ALIASES.includes(p))) return true;
  return permissions.some((p) => p === required || p.startsWith(required + ':'));
}

/**
 * Verifica la API key de la peticion contra Postgres (tabla api_keys, hash
 * HMAC-SHA256 -- ver src/lib/apiKeySecurity.ts). Devuelve null si es valida, o
 * una NextResponse de error si no lo es.
 */
 export async function requireApiKey(
   req: NextRequest,
   required: Permission = 'read'
 ): Promise<NextResponse | null> {
   const key = extractApiKey(req);

   if (!key) {
     return NextResponse.json(
       { success: false, error: 'Falta la cabecera x-api-key' },
       { status: 401 }
     );
   }

   const master = process.env.API_MASTER_KEY;
   if (master && key === master) return null;

   const db = await connectToPostgres();
   if (!db) {
     return NextResponse.json(
       { success: false, error: 'No se pudo validar la credencial' },
       { status: 503 }
     );
   }

   const record = await db.apiKey.findUnique({ where: { keyHash: hashApiKey(key) } });
   if (!record) {
     return NextResponse.json(
       { success: false, error: 'Credencial invalida' },
       { status: 401 }
     );
   }

   if (!hasPermissions(record.permissions || [], required)) {
     return NextResponse.json(
       { success: false, error: 'Permisos insuficientes para esta operacion' },
       { status: 403 }
     );
   }

   await db.apiKey
     .update({
       where: { id: record.id },
       data: { lastUsed: new Date().toISOString().split('T')[0] },
     })
     .catch(() => null);

   return null;
 }

/**
 * Devuelve la lista de permisos de la credencial que hace la peticion, o null si
 * no se puede determinar (falta la clave, es invalida o la BD no responde).
 * Solo lectura: no actualiza `lastUsed`. Se usa para que el frontend pueda
 * reflejar los permisos (p. ej. ocultar acciones destructivas). La fuente de
 * verdad sigue siendo `requireApiKey` en cada route handler.
 */
// export async function getApiKeyPermissions(req: NextRequest): Promise<string[] | null> {
//   const key = extractApiKey(req);
//   if (!key) return null;

//   const master = process.env.API_MASTER_KEY;
//   if (master && key === master) return ['admin'];

//   const db = await connectToPostgres();
//   if (!db) return null;

//   const record = await db.apiKey.findUnique({ where: { keyHash: hashApiKey(key) } });
//   return record ? record.permissions || [] : null;
// }

export async function getApiKeyPermissions(req: NextRequest): Promise<string[] | null> {
  const userId = req.headers.get('x-verified-user-id')
  if (!userId) return null;

  const db = await connectToPostgres();
  if (!db) return null;
  const user = await db.user.findUnique({ where: { id: userId } })

  const granted = ROLE_PERMISSIONS[user.role]
  if (!granted) return null;
  return granted;
}


export interface AuthPayload {
  userId: string
}

function extractToken(req: NextRequest) {
  // const authorization = req.headers.get('authorization') || null;
  // const match = authorization.match(/^Bearer\s+(.+)$/i)
  // return match[1] || null

  return req.cookies.get('session_token')?.value || null
}


export async function requireUserPermission(req: NextRequest, required: Permission): Promise<NextResponse | null> {

  const userId = req.headers.get('x-verified-user-id')
  if (!userId) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  }

  const db = await connectToPostgres();
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || !hasPermission(user.role, required)) {
    return NextResponse.json(
      { success: false, error: 'Permisos insuficientes para esta operación' },
      {
        status: 403
      }
    )
  }

  return null



}

export async function requireAuth(req: NextRequest) {
  const token = extractToken(req)

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Falta el token de autenticación' },
        { status: 401 }
      )
    }
  }

  try {
    const { payload } = await jwtVerify(token, secret)
    return { payload: payload as unknown as AuthPayload }
  } catch {
    return {
      error: NextResponse.json(
        { success: false, error: 'Token inválido o expirado' },
        { status: 401 }
      )
    }
  }
}