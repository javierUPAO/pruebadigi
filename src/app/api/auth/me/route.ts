import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyPermissions, requireUserPermission } from '@/lib/auth';

/**
 * Devuelve los permisos de la credencial que hace la peticion y un resumen de
 * capacidades derivadas, para que el frontend refleje correctamente lo que el
 * usuario puede hacer (p. ej. ocultar el boton de eliminar campañas).
 *
 * NO es un mecanismo de seguridad: cada route handler revalida con
 * rechazaria.
 */
export async function GET(req: NextRequest) {
  const denied = await requireUserPermission(req, 'read');
  if (denied) return denied;

  const permissions = (await getApiKeyPermissions(req)) ?? [];

  return NextResponse.json({
    success: true,
    data: {
      permissions,
      // capabilities: {
      //   campaigns: {
      //     delete: hasPermission(permissions, 'delete'),
      //   },
      // },
    },
  });
}
