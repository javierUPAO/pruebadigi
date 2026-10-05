'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface QrData {
  image: string;
  expiresAt: number;
  createdAt: string;
}

interface WhatsAppConnectViewProps {
  connectionStatus?: 'connected' | 'qr-ready' | 'disconnected';
  qrData?: QrData | null;
  onRequestQr?: () => void;
  /** Cierra la sesion actual en el servicio para poder vincular otra cuenta. */
  onDisconnect?: () => Promise<void> | void;
}

export function WhatsAppConnectView({
  connectionStatus = 'disconnected',
  qrData = null,
  onRequestQr,
  onDisconnect,
}: WhatsAppConnectViewProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  // Dos pasos a proposito: desvincular tumba el canal real del CRM, no es un
  // boton que convenga disparar de un solo clic accidental.
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const calculateTimeLeft = useCallback(() => {
    if (!qrData?.expiresAt) return 0;
    const now = Date.now();
    const diff = Math.max(0, Math.floor((qrData.expiresAt - now) / 1000));
    return diff;
  }, [qrData?.expiresAt]);

  useEffect(() => {
    if (!qrData?.expiresAt) {
      setTimeLeft(0);
      return;
    }

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [qrData?.expiresAt, calculateTimeLeft]);

  const isConnected = connectionStatus === 'connected';

  // Al soltarse la sesion el boton ya no aplica: no dejes la confirmacion abierta.
  useEffect(() => {
    if (!isConnected) {
      setConfirmingDisconnect(false);
      setDisconnecting(false);
    }
  }, [isConnected]);

  const handleDisconnect = async () => {
    if (!onDisconnect || disconnecting) return;
    setDisconnecting(true);
    try {
      await onDisconnect();
      setConfirmingDisconnect(false);
    } finally {
      setDisconnecting(false);
    }
  };

  const isQrReady = connectionStatus === 'qr-ready' && qrData?.image;
  const isExpired = timeLeft <= 0 && qrData?.expiresAt;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
        <h1 className="text-lg font-bold text-white">Conecta tu WhatsApp Business</h1>
        <p className="mt-2 text-sm text-slate-400">
          Escanea el código con WhatsApp para vincular tu cuenta y empezar a recibir mensajes.
        </p>

        {/* QR Code Display */}
        <div className="mx-auto mt-6 flex h-56 w-56 items-center justify-center rounded-xl bg-white p-3">
          {isConnected ? (
            <div className="flex flex-col items-center gap-2">
              <svg className="h-16 w-16 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-semibold text-emerald-600">Conectado</span>
            </div>
          ) : isQrReady && !isExpired ? (
            <img
              src={qrData!.image}
              alt="QR WhatsApp"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />
              <span className="text-xs text-slate-500">Generando código...</span>
            </div>
          )}
        </div>

        {/* Status & Timer */}
        <div className="mt-6 flex flex-col items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Conectado exitosamente
            </div>
          ) : isQrReady && !isExpired ? (
            <>
              <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                Escanea el código QR
              </div>
              {timeLeft > 0 && (
                <span className="text-xs text-slate-500">
                  Expira en {timeLeft}s
                </span>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
              Esperando conexión...
            </div>
          )}
        </div>

        {/* Request New QR Button */}
        {(!isQrReady || isExpired) && !isConnected && onRequestQr && (
          <button
            onClick={onRequestQr}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Solicitar nuevo código
          </button>
        )}

        {/* Desvincular: la unica salida cuando la sesion activa es de otra cuenta */}
        {isConnected && onDisconnect && (
          <div className="mt-4">
            {confirmingDisconnect ? (
              <div className="rounded-lg border border-red-900/60 bg-red-950/40 p-3">
                <p className="text-xs text-red-200">
                  Se cerrara la sesion de WhatsApp y el CRM dejara de enviar y recibir
                  mensajes hasta que escanees un codigo nuevo.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                  >
                    {disconnecting ? 'Desvinculando...' : 'Si, desvincular'}
                  </button>
                  <button
                    onClick={() => setConfirmingDisconnect(false)}
                    disabled={disconnecting}
                    className="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDisconnect(true)}
                className="rounded-lg border border-red-900/60 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-950/40"
              >
                Desvincular cuenta
              </button>
            )}
          </div>
        )}

        <ol className="mt-6 space-y-1 text-left text-xs text-slate-500">
          <li>1. Abre WhatsApp en tu teléfono</li>
          <li>2. Ve a Configuración → Dispositivos vinculados</li>
          <li>3. Toca "Vincular un dispositivo" y escanea este código</li>
        </ol>

    
      </div>
    </div>
  );
}