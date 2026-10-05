import { NextRequest, NextResponse } from 'next/server';
import { AiConfigurationError, getAiClient, getAiModel, isAiKeyConfigured } from '@/lib/gemini';
import { captureException } from '@/lib/logger';
import { enforceAiRateLimit } from '@/lib/rateLimit';
import { logger, motivo } from '@/lib/logger';
import { requireUserPermission } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const denied = await requireUserPermission(req, 'write');
  if (denied) return denied;

  const limited = await enforceAiRateLimit(req, 'generalAI');
  if (limited) return limited;

  try {
    const { conversationHistory, contactName, channel, stage } = await req.json();

    if (!isAiKeyConfigured()) {
      // Fallback response for offline / unconfigured API Key
      return NextResponse.json({
        success: true,
        data: {
          sentiment: 'positive',
          suggestedReplies: [
            {
              label: 'Casual / Amigable',
              text: `¡Hola ${contactName || ''}! Claro que sí, con mucho gusto te ayudo con la información que necesitas sobre XIO CRM. 😊`
            },
            {
              label: 'Profesional / Formal',
              text: `Estimado(a) ${contactName || ''}, gracias por comunicarse con nosotros. Con gusto le comparto los detalles solicitados y agendamos una demostración.`
            },
            {
              label: 'Cierre / Oferta Directa',
              text: `¡Excelente oportunidad ${contactName || ''}! Tenemos una promoción activa para activación inmediata. ¿Te gustaría apartar tu cupo hoy mismo?`
            }
          ],
          reasoning: 'Respuesta sugerida predeterminada (Clave GEMINI_API_KEY pendiente de configurar)'
        }
      });
    }

    const ai = getAiClient();
    const prompt = `
      Eres un asistente experto de CRM omnicanal para ventas y soporte al cliente en español para XIO CRM.
      Genera 3 opciones de respuesta rápida para el cliente "${contactName || 'Cliente'}" en el canal "${channel || 'whatsapp'}".
      Etapa de venta actual del cliente: "${stage || 'lead'}".

      Historial reciente de la conversación:
      ${JSON.stringify(conversationHistory || [], null, 2)}

      RESPONDE EXCLUSIVAMENTE EN FORMATO JSON CON ESTA ESTRUCTURA EXACTA:
      {
        "sentiment": "positive" | "neutral" | "urgent" | "churn_risk",
        "suggestedReplies": [
          { "label": "Casual / Amigable", "text": "..." },
          { "label": "Profesional / Formal", "text": "..." },
          { "label": "Cierre / Oferta Directa", "text": "..." }
        ],
        "reasoning": "Breve explicación de la estrategia seleccionada"
      }
    `;

    const response = await ai.models.generateContent({
      model: getAiModel(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    const errorId = captureException(error, { route: '/api/ai/smart-reply', method: 'POST' });
    if (error instanceof AiConfigurationError) {
      return NextResponse.json(
        { success: false, error: error.message, errorId },
        { status: 503 }
      );
    }
    logger.error('Error in /api/ai/smart-reply', { motivo: motivo(error) });
    return NextResponse.json(
      {
        success: false,
        error: 'Error al generar respuestas IA',
        errorId,
      },
      { status: 500 }
    );
  }
}