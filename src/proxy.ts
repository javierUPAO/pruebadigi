import { NextRequest, NextResponse } from "next/server";
import { isSeedAllowed } from "@/lib/seedGuard";
import { resolveAllowedOrigin, applyCorsHeaders } from "@/lib/cors";
import { requireAuth } from "./lib/auth";

/**
 * Middleware de proteccion para las rutas /api/*.
 * Corre en Edge Runtime, por lo que no puede usar Mongoose:
 * aqui solo se resuelve CORS, se valida la presencia de la credencial y se
 * bloquea el seed destructivo segun entorno. La validacion contra la base de
 * datos ocurre dentro de cada route handler via requireApiKey().
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const allowOrigin = resolveAllowedOrigin(req.headers.get("origin"));

  // Preflight CORS: se responde antes de exigir la credencial, porque el
  // navegador no envia cabeceras propias (x-api-key) en la peticion OPTIONS.
  if (req.method === "OPTIONS") {
    return applyCorsHeaders(
      new NextResponse(null, { status: 204 }),
      allowOrigin,
    );
  }

  if (
    (pathname === "/api/seed" || pathname === "/api/seed/") &&
    !isSeedAllowed()
  ) {
    return applyCorsHeaders(
      NextResponse.json(
        {
          success: false,
          error:
            "El endpoint de seed (destructivo) esta deshabilitado en este entorno. Define ALLOW_DESTRUCTIVE_SEED=true para habilitarlo.",
        },
        { status: 403 },
      ),
      allowOrigin,
    );
  }

  // Healthchecks para balanceadores y orquestadores: quedan fuera de la
  // exigencia de credencial porque estos clientes (k8s, ALB, etc.) no pueden
  // adjuntar x-api-key. Ninguno de los dos expone secretos: /api/health/live
  // solo confirma que el proceso responde, y /api/health solo agrega banderas
  // booleanas de conexion (sin credenciales, URIs ni datos de negocio).
  if (
    pathname === "/api/health/live" ||
    pathname === "/api/health/live/" ||
    pathname === "/api/health" ||
    pathname === "/api/health/"
  ) {
    return applyCorsHeaders(NextResponse.next(), allowOrigin);
  }

  // Webhook de Meta: llega con su propia firma (X-Hub-Signature-256), no con
  // nuestra x-api-key, asi que no puede exigirsele la credencial. La ruta
  // verifica el HMAC contra WHATSAPP_APP_SECRET antes de procesar nada.
  if (
    pathname === "/api/webhooks/whatsapp" ||
    pathname === "/api/webhooks/whatsapp/"
  ) {
    return applyCorsHeaders(NextResponse.next(), allowOrigin);
  }

  // Disparador del worker de campanas: lo llama un cron, que no tiene sesion
  // de usuario ni puede renovar un JWT. Igual que el webhook, trae su propia
  // credencial (CRON_SECRET) y la propia ruta la verifica en tiempo constante
  // antes de tocar nada; sin ella responde 401. Exceptuarla aqui no la deja
  // abierta, solo cambia QUE credencial se le exige.
  if (
    pathname === "/api/campaigns/tick" ||
    pathname === "/api/campaigns/tick/"
  ) {
    return applyCorsHeaders(NextResponse.next(), allowOrigin);
  }
  if (
    pathname === "/api/whatsapp/outgoing" ||
    pathname === "/api/whatsapp/outgoing/"
  ) {
    return applyCorsHeaders(NextResponse.next(), allowOrigin);
  }

  const isLoginRequest = pathname === "/api/auth/user" && req.method === "POST";

  if (!isLoginRequest) {
    const auth = await requireAuth(req);
    if ("error" in auth) return auth.error;

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-verified-user-id", auth.payload.userId);

    return applyCorsHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      allowOrigin,
    );
  }

  return applyCorsHeaders(NextResponse.next(), allowOrigin);
}

export const config = {
  matcher: "/api/:path*",
};
