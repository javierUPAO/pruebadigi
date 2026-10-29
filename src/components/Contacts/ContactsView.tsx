import React, { useState, useEffect, useRef } from "react";
import {
  Contact,
  Conversation,
  Message,
  PipelineStage,
  SocialChannel,
} from "../../types";
import {
  Users,
  Plus,
  Search,
  DollarSign,
  Sparkles,
  Mail,
  Tag,
  Trash2,
  MessageSquare,
  MessageCircle,
  Instagram,
  Twitter,
  Sprout,
  Target,
  Briefcase,
  PartyPopper,
  XCircle,
  BarChart3,
  Star,
  Smartphone,
  User,
  ArrowRight,
  Inbox,
  RefreshCw,
  Settings,
  AlertCircle,
  FileText,
  XCircleIcon,
  GripVertical,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { ContactAvatar } from "@/components/Contacts/ContactAvatar";
import { contactCreateSchema } from "@/lib/schemas";
import { apiFetch } from "@/lib/apiClient";
import { AI_MODEL_NAME } from "@/lib/constants";

// Filas visibles por pagina en la vista "Tabla".
const TABLE_PAGE_SIZE = 20;

interface ContactsViewProps {
  contacts: Contact[];
  onUpdateStage: (contactId: string, stage: PipelineStage) => void;
  onToggleInteraction?: (
    contactId: string,
    interactionKey:
      | "firstReply"
      | "appointmentConfirmed"
      | "proposalSent"
      | "dealClosed",
  ) => void;
  onAddContact: (newContact: Omit<Contact, "id">) => Promise<string | null>;
  onSelectConversationByContactId: (contactId: string) => void;
  onDeleteContact: (contactId: string) => void;
  /** Estado de busqueda global compartido con el Header y el resto de vistas. */
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  conversations: Conversation[];
  messagesMap: Record<string, Message[]>;
}

const getChannelBadge = (channel: SocialChannel) => {
  switch (channel) {
    case "whatsapp":
      return (
        <span className="text-emerald-700 font-bold flex items-center gap-1">
          💬 WhatsApp
        </span>
      );
    case "instagram":
      return (
        <span className="text-pink-700 font-bold flex items-center gap-1">
          📸 Instagram
        </span>
      );
    case "twitter":
      return (
        <span className="text-sky-600 font-bold flex items-center gap-1">
          🐦 X / Twitter
        </span>
      );
    case "messenger":
      return (
        <span className="text-blue-700 font-bold flex items-center gap-1">
          🔵 Messenger
        </span>
      );
    default:
      return (
        <span className="text-purple-700 font-bold flex items-center gap-1">
          📧 Email
        </span>
      );
  }
};

const STAGE_MOVE_OPTIONS: { value: PipelineStage; label: string }[] = [
  { value: "lead", label: "🌱 Mover a Prospecto" },
  { value: "qualified", label: "🎯 Mover a Cualificado" },
  { value: "negotiation", label: "💼 Mover a Negociación" },
  { value: "closed_won", label: "🎉 Mover a Ganada" },
  { value: "closed_lost", label: "❌ Mover a Perdida" },
];

type InteractionKey =
  | "firstReply"
  | "appointmentConfirmed"
  | "proposalSent"
  | "dealClosed";

const INTERACTIONS: {
  key: InteractionKey;
  label: string;
  caption: string;
  aria: string;
  activeBar: string;
  dot: string;
  onClass: string;
}[] = [
  {
    key: "firstReply",
    label: "1ª Respuesta positiva",
    caption: "1ª Resp.",
    aria: "1ª interacción: respuesta positiva al primer mensaje (pasa a Cualificados)",
    activeBar: "bg-red-600 ring-2 ring-red-400 shadow-xs",
    dot: "bg-red-600",
    onClass: "bg-red-50 border-red-300 text-red-800",
  },
  {
    key: "appointmentConfirmed",
    label: "2ª Cita confirmada",
    caption: "2ª Cita",
    aria: "2ª interacción: cita confirmada (pasa a Negociación)",
    activeBar: "bg-yellow-400 ring-2 ring-yellow-300 shadow-xs",
    dot: "bg-yellow-400",
    onClass: "bg-yellow-50 border-yellow-300 text-yellow-800",
  },
  {
    key: "proposalSent",
    label: "3ª Propuesta enviada",
    caption: "3ª Prop.",
    aria: "3ª interacción: propuesta enviada",
    activeBar: "bg-amber-500 ring-2 ring-amber-300 shadow-xs",
    dot: "bg-amber-500",
    onClass: "bg-amber-50 border-amber-300 text-amber-800",
  },
  {
    key: "dealClosed",
    label: "4ª Cierre / Pago",
    caption: "4ª Pago",
    aria: "4ª interacción: venta cerrada y pago confirmado",
    activeBar: "bg-emerald-600 ring-2 ring-emerald-400 shadow-xs",
    dot: "bg-emerald-600",
    onClass: "bg-emerald-50 border-emerald-300 text-emerald-800",
  },
];

const MobileContactCard: React.FC<{
  contact: Contact;
  onUpdateStage: ContactsViewProps["onUpdateStage"];
  onToggleInteraction?: ContactsViewProps["onToggleInteraction"];
  onSelectConversationByContactId: ContactsViewProps["onSelectConversationByContactId"];
  onDeleteContact: ContactsViewProps["onDeleteContact"];
  handleSummarizeConversation: (
    conv: Conversation | undefined,
    contact: Contact,
  ) => Promise<void>;
  isSummaryLoading: boolean;
  summaryWait: number;
  summaryData: {
    contactId: string;
    summary: string;
    keyIntent: string;
    suggestedNextAction: string;
  } | null;
  setSummaryData: React.Dispatch<
    React.SetStateAction<{
      contactId: string;
      summary: string;
      keyIntent: string;
      suggestedNextAction: string;
    } | null>
  >;
  conversations: Conversation[];
  isBeingTouchDragged?: boolean;
  onTouchStartCard?: (e: React.TouchEvent, contact: Contact) => void;
  onTouchMoveCard?: (e: React.TouchEvent) => void;
  onTouchEndCard?: () => void;
}> = ({
  contact,
  onUpdateStage,
  onToggleInteraction,
  onSelectConversationByContactId,
  onDeleteContact,
  handleSummarizeConversation,
  isSummaryLoading,
  summaryWait,
  summaryData,
  setSummaryData,
  conversations,
  isBeingTouchDragged = false,
  onTouchStartCard,
  onTouchMoveCard,
  onTouchEndCard,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const detailsId = `contact-details-${contact.id}`;

  return (
    <article
      onTouchStart={(e) => onTouchStartCard && onTouchStartCard(e, contact)}
      onTouchMove={(e) => onTouchMoveCard && onTouchMoveCard(e)}
      onTouchEnd={() => onTouchEndCard && onTouchEndCard()}
      onTouchCancel={() => onTouchEndCard && onTouchEndCard()}
      className={`p-4 bg-white border rounded-2xl shadow-xs space-y-3 transition-all select-none ${
        isBeingTouchDragged
          ? "opacity-40 scale-95 border-emerald-500 ring-2 ring-emerald-400/40 bg-emerald-50/30"
          : "border-slate-200"
      }`}
    >
      {/* Cabecera: icono de arrastre tactil + avatar + identidad + valor del deal */}
      <div className="flex items-start gap-2.5">
        <div
          title="Mantén presionado para arrastrar a otra etapa"
          className="pt-2 text-slate-300 active:text-emerald-600 shrink-0 cursor-grab"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <ContactAvatar
          name={contact.name}
          src={
            contact.avatar ||
            "https://cdn-icons-png.flaticon.com/512/149/149071.png"
          }
          size={40}
        />

        <div className="min-w-0 flex-1">
          <h4 className="font-extrabold text-sm text-emerald-900 truncate">
            {contact.name}
          </h4>
          {contact.company && (
            <p className="text-[11px] text-slate-500 font-semibold truncate">
              🏢 {contact.company}
            </p>
          )}
          <p className="text-[11px] text-slate-500 font-mono truncate">
            {contact.email
              ? `📧 ${contact.email}`
              : `📱 ${contact.phone || contact.handle}`}
          </p>
          <div className="mt-1 text-[11px]">
            {getChannelBadge(contact.channel)}
          </div>
        </div>
        <span className="shrink-0 text-slate-900 font-black text-xs tracking-tight bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
          💰 ${contact.dealValue.toLocaleString()}
        </span>
      </div>

      {/* Estado actual + score IA */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-start gap-1">
          <button
            onClick={() =>
              handleSummarizeConversation(
                conversations.find((c) => c.contactId === contact.id),
                contact,
              )
            }
            disabled={isSummaryLoading || summaryWait > 0}
            title={
              summaryWait > 0
                ? `Límite de solicitudes excedido. Reintenta en ${summaryWait}s.`
                : undefined
            }
            className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="inline">
              {summaryWait > 0
                ? `Espera ${summaryWait}s`
                : isSummaryLoading
                  ? "Analizando..."
                  : "Resumen IA"}
            </span>
          </button>
        </div>
        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-extrabold rounded-full border border-emerald-200">
          ⭐ IA {contact.leadScore}%
        </span>
        {summaryData && summaryData.contactId === contact.id && (
          <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200 text-xs text-slate-800 justify-between shadow-2xs w-full rounded-xl">
            <div className="space-y-1.5 flex items-center flex-col">
              <button
                onClick={() => setSummaryData(null)}
                aria-label="Cerrar resumen ejecutivo IA"
                className="text-slate-400 hover:text-slate-700 px-2 cursor-pointer self-end"
              >
                <XCircleIcon className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-2 font-extrabold text-emerald-900">
                <Sparkles className="w-4 h-4" />
                <span>Resumen Ejecutivo IA (XIO + {AI_MODEL_NAME}):</span>
              </div>
              <p className="text-slate-700 leading-relaxed font-medium bg-white/60 p-2 rounded-xl border border-emerald-100">
                {summaryData.summary}
              </p>
              <div className="flex flex-col justify-center items-start gap-2 text-[11px] text-slate-700 pt-0.5 w-full">
                <span>
                  <strong>Intención Principal:</strong> {summaryData.keyIntent}
                </span>
                <span>
                  <strong>Siguiente Acción:</strong>{" "}
                  {summaryData.suggestedNextAction}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Etiquetas */}
      {contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {contact.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 bg-slate-100 text-slate-800 text-[10px] rounded-md font-bold border border-slate-200"
            >
              🏷️ {t}
            </span>
          ))}
        </div>
      )}

      {/* Selector de cambio de etapa conservado */}
      <select
        value={contact.stage}
        onChange={(e) =>
          onUpdateStage(contact.id, e.target.value as PipelineStage)
        }
        aria-label={`Cambiar etapa de ${contact.name}`}
        className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      >
        {STAGE_MOVE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Acciones principales */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSelectConversationByContactId(contact.id)}
          className="flex-1 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl border border-emerald-200 text-xs transition-colors cursor-pointer"
        >
          💬 Abrir Chat
        </button>
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          aria-controls={detailsId}
          aria-label={
            showDetails
              ? `Ocultar detalles de ${contact.name}`
              : `Ver detalles de ${contact.name}`
          }
          className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={() => setContactToDelete(contact)}
          aria-label={`Eliminar a ${contact.name}`}
          className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE CONTACTO */}
      <Modal
        isOpen={contactToDelete != null}
        onClose={() => setContactToDelete(null)}
        title="🗑️ Eliminar contacto"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setContactToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (contactToDelete) {
                  onDeleteContact(contactToDelete.id);
                  setContactToDelete(null);
                }
              }}
            >
              Eliminar contacto
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-md text-black">
            ¿Estás seguro de que deseas eliminar el contacto?
          </p>
          {contactToDelete && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-md font-extrabold text-red-800">
                {contactToDelete.name}
              </p>
            </div>
          )}
          <p className="text-md text-black">
            Esta acción no se puede deshacer.
          </p>
        </div>
      </Modal>

      {/* Detalle expandible: interacciones + contacto secundario */}
      {showDetails && (
        <div
          id={detailsId}
          className="pt-3 border-t border-slate-100 space-y-3 animate-fadeIn"
        >
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              🔄 Interacciones
            </p>
            <div className="grid grid-cols-2 gap-2">
              {INTERACTIONS.map((it) => {
                const active = !!contact.interactions?.[it.key];
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() =>
                      onToggleInteraction &&
                      onToggleInteraction(contact.id, it.key)
                    }
                    aria-pressed={active}
                    className={`flex items-center gap-2 min-w-0 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold text-left transition-colors cursor-pointer ${
                      active
                        ? it.onClass
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${active ? it.dot : "bg-slate-300"}`}
                    />
                    <span className="leading-tight">{it.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {(contact.phone || contact.email) && (
            <div className="text-[11px] text-slate-500 font-mono space-y-0.5">
              {contact.phone && <p>📱 {contact.phone}</p>}
              {contact.email && <p>📧 {contact.email}</p>}
            </div>
          )}
        </div>
      )}
    </article>
  );
};

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  onUpdateStage,
  onToggleInteraction,
  onAddContact,
  onSelectConversationByContactId,
  onDeleteContact,
  searchQuery,
  setSearchQuery,
  conversations,
  messagesMap,
}) => {
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addContactError, setAddContactError] = useState<string | null>(null);
  const [isSavingContact, setIsSavingContact] = useState<boolean>(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);

  const [summaryData, setSummaryData] = useState<{
    contactId: string;
    summary: string;
    keyIntent: string;
    suggestedNextAction: string;
  } | null>(null);
  const [summaryWait, startSummaryWait] = useRetryCountdown();
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);

  const [openStages, setOpenStages] = useState<Set<PipelineStage>>(
    () => new Set<PipelineStage>(["lead"]),
  );

  // =========================================================================
  // ESTADOS DE DRAG & DROP (ESCRITORIO Y MÓVIL CON PRESS & HOLD)
  // =========================================================================
  const [draggedContactId, setDraggedContactId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(
    null,
  );

  // Estados y refs para Press & Hold en Móvil
  const [touchDragContact, setTouchDragContact] = useState<Contact | null>(
    null,
  );
  const [touchCoords, setTouchCoords] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isTouchDraggingRef = useRef<boolean>(false);

  const validStages: PipelineStage[] = [
    "lead",
    "qualified",
    "negotiation",
    "closed_won",
    "closed_lost",
  ];
  const isValidStage = (val: string | null): val is PipelineStage =>
    !!val && validStages.includes(val as PipelineStage);

  // --- Handlers de Escritorio (HTML5 Drag & Drop) ---
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    contact: Contact,
  ) => {
    setOpenSummaryContactId(null);
    // Evitar iniciar arrastre si el usuario interactúa con un select o botón
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (
      targetTag === "select" ||
      targetTag === "button" ||
      targetTag === "option"
    ) {
      e.preventDefault();
      return;
    }
    setDraggedContactId(contact.id);
    e.dataTransfer.setData("text/plain", contact.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverColumn = (
    e: React.DragEvent<HTMLDivElement>,
    stageId: PipelineStage,
  ) => {
    e.preventDefault(); // Indispensable para permitir el drop
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stageId) {
      setDragOverStage(stageId);
    }
  };

  const handleDragLeaveColumn = (
    e: React.DragEvent<HTMLDivElement>,
    stageId: PipelineStage,
  ) => {
    // Solo limpiar si realmente salimos del contenedor de la columna y no hacia un hijo
    const related = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(related)) {
      if (dragOverStage === stageId) {
        setDragOverStage(null);
      }
    }
  };

  const handleDropOnColumn = (
    e: React.DragEvent<HTMLDivElement>,
    targetStage: PipelineStage,
  ) => {
    e.preventDefault();
    const droppedContactId =
      e.dataTransfer.getData("text/plain") || draggedContactId;

    setDraggedContactId(null);
    setDragOverStage(null);

    if (!droppedContactId || !isValidStage(targetStage)) return;

    const contact = contacts.find((c) => c.id === droppedContactId);
    // Si la posición es válida y la etapa es distinta a la actual, actualizamos
    if (contact && contact.stage !== targetStage) {
      onUpdateStage(contact.id, targetStage);
    }
  };

  const handleDragEnd = () => {
    // Si se soltó en cualquier lugar inválido fuera de las columnas, simplemente limpia el estado y vuelve a su sitio
    setDraggedContactId(null);
    setDragOverStage(null);
  };

  // --- Handlers de Móvil (Simulación de Press & Hold 350ms) ---
  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStartCard = (e: React.TouchEvent, contact: Contact) => {
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (
      targetTag === "select" ||
      targetTag === "button" ||
      targetTag === "option" ||
      (e.target as HTMLElement)?.closest("button, select")
    ) {
      return;
    }

    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      isTouchDraggingRef.current = true;
      setTouchDragContact(contact);
      setDraggedContactId(contact.id);
      setTouchCoords({ x: touch.clientX, y: touch.clientY });
      setDragOverStage(contact.stage);

      // Vibración háptica suave en teléfonos compatibles
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(45);
      }
    }, 350);
  };

  const handleTouchMoveCard = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    // Si aún no se activó el press & hold y el usuario mueve el dedo (> 10px), es un scroll normal: cancelamos el timer
    if (!isTouchDraggingRef.current) {
      const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
      if (dx > 10 || dy > 10) {
        clearLongPressTimer();
      }
      return;
    }

    // Ya estamos en modo arrastre móvil: actualizamos coordenadas del fantasma
    setTouchCoords({ x: touch.clientX, y: touch.clientY });

    // Auto-scroll suave si acerca el dedo al borde superior o inferior de la pantalla
    const edgeThreshold = 75;
    if (touch.clientY < edgeThreshold) {
      window.scrollBy({ top: -8, behavior: "auto" });
    } else if (window.innerHeight - touch.clientY < edgeThreshold) {
      window.scrollBy({ top: 8, behavior: "auto" });
    }

    // Detectar sobre qué etapa del Kanban está pasando el dedo usando data-stage-drop
    const elementUnderFinger = document.elementFromPoint(
      touch.clientX,
      touch.clientY,
    );
    const stageSection = elementUnderFinger?.closest(
      "[data-stage-drop]",
    ) as HTMLElement | null;
    const detectedStage = stageSection?.getAttribute("data-stage-drop") || null;

    if (isValidStage(detectedStage)) {
      setDragOverStage(detectedStage);
    } else {
      setDragOverStage(null);
    }
  };

  const handleTouchEndCard = () => {
    clearLongPressTimer();

    if (!isTouchDraggingRef.current) return;

    const contact = touchDragContact;
    const targetStage = dragOverStage;

    isTouchDraggingRef.current = false;
    setTouchDragContact(null);
    setDraggedContactId(null);
    setDragOverStage(null);

    // Si soltó en una etapa válida distinta a la original, actualizamos y abrimos ese acordeón para que vea su tarjeta
    if (contact && isValidStage(targetStage) && contact.stage !== targetStage) {
      onUpdateStage(contact.id, targetStage);
      setOpenStages((prev) => {
        const next = new Set(prev);
        next.add(targetStage);
        return next;
      });
    }
  };

  function useRetryCountdown(): [number, (seconds: number) => void] {
    const [secondsLeft, setSecondsLeft] = useState<number>(0);

    useEffect(() => {
      if (secondsLeft <= 0) return;
      const intervalId = setInterval(() => {
        setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
      return () => clearInterval(intervalId);
    }, [secondsLeft]);

    const start = (seconds: number) => {
      setSecondsLeft(
        Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0,
      );
    };

    return [secondsLeft, start];
  }

  const handleSummarizeConversation = async (
    conv: Conversation | undefined,
    contact: Contact,
  ) => {
    if (!conv || !contact || summaryWait > 0) return;
    setIsSummaryLoading(true);

    const activeMessages = messagesMap[conv.id] || [];

    try {
      const response = await apiFetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: activeMessages.map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
          contactName: contact.name,
        }),
      });

      const resData = await response.json();

      if (!resData.success && response.status === 429) {
        const retrySeconds =
          Number(resData.retryAfter) ||
          Number(response.headers.get("Retry-After")) ||
          1;
        startSummaryWait(retrySeconds);
      }

      if (resData.success && resData.data) {
        startSummaryWait(0);
        setSummaryData({ contactId: contact.id, ...resData.data });
      }
    } catch (err) {
      console.error("Error summarizing conversation:", err);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const getChannelBadge = (channel: SocialChannel) => {
    switch (channel) {
      case "whatsapp":
        return (
          <span className="text-emerald-700 font-bold flex items-center gap-1">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </span>
        );
      case "instagram":
        return (
          <span className="text-pink-700 font-bold flex items-center gap-1">
            <Instagram className="w-3.5 h-3.5" /> Instagram
          </span>
        );
      case "twitter":
        return (
          <span className="text-sky-600 font-bold flex items-center gap-1">
            <Twitter className="w-3.5 h-3.5" /> X / Twitter
          </span>
        );
      case "messenger":
        return (
          <span className="text-blue-700 font-bold flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" /> Messenger
          </span>
        );
      default:
        return (
          <span className="text-purple-700 font-bold flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" /> Email
          </span>
        );
    }
  };

  const toggleStage = (id: PipelineStage) => {
    setOpenStages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    channel: "whatsapp" as SocialChannel,
    dealValue: 2400,
    stage: "lead" as PipelineStage,
    tags: "VIP, WhatsApp, Cotización Activa",
    company: "",
  });

  const stages: {
    id: PipelineStage;
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    badgeColor: string;
  }[] = [
    {
      id: "lead",
      label: "Prospectos Iniciales",
      icon: Sprout,
      color: "border-slate-300",
      bgColor: "bg-slate-50/90",
      badgeColor: "bg-slate-200 text-slate-800",
    },
    {
      id: "qualified",
      label: "Cualificados",
      icon: Target,
      color: "border-blue-400",
      bgColor: "bg-blue-50/70",
      badgeColor: "bg-blue-200 text-blue-900",
    },
    {
      id: "negotiation",
      label: "En Negociación",
      icon: Briefcase,
      color: "border-amber-400",
      bgColor: "bg-amber-50/70",
      badgeColor: "bg-amber-200 text-amber-900",
    },
    {
      id: "closed_won",
      label: "Venta Ganada",
      icon: PartyPopper,
      color: "border-emerald-500",
      bgColor: "bg-emerald-50/85",
      badgeColor: "bg-emerald-200 text-emerald-900",
    },
    {
      id: "closed_lost",
      label: "Perdidos",
      icon: XCircle,
      color: "border-rose-300",
      bgColor: "bg-rose-50/50",
      badgeColor: "bg-rose-200 text-rose-900",
    },
  ];

  const filteredContacts = contacts.filter((c) => {
    const matchesChannel =
      selectedChannel === "all" || c.channel === selectedChannel;
    const matchesSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesChannel && matchesSearch;
  });

  const totalPipelineValue = filteredContacts.reduce(
    (acc, c) => acc + c.dealValue,
    0,
  );
  const totalWonValue = filteredContacts
    .filter((c) => c.stage === "closed_won")
    .reduce((acc, c) => acc + c.dealValue, 0);

  const [tablePage, setTablePage] = useState(1);
  const tablePageCount = Math.max(
    1,
    Math.ceil(filteredContacts.length / TABLE_PAGE_SIZE),
  );
  const safeTablePage = Math.min(tablePage, tablePageCount);
  const pagedContacts = filteredContacts.slice(
    (safeTablePage - 1) * TABLE_PAGE_SIZE,
    safeTablePage * TABLE_PAGE_SIZE,
  );

  useEffect(() => {
    setTablePage(1);
  }, [searchQuery, selectedChannel, viewMode]);

  useEffect(() => {
    if (tablePage > tablePageCount) setTablePage(tablePageCount);
  }, [tablePage, tablePageCount]);

  const trimmedName = formData.name.trim();
  const trimmedPhone = formData.phone.trim();
  const trimmedEmail = formData.email.trim();
  const isNewContactFormValid =
    trimmedName.length > 0 &&
    (trimmedPhone.length > 0 || trimmedEmail.length > 0);

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!trimmedName) {
      setAddContactError("El nombre es obligatorio.");
      return;
    }
    if (!trimmedPhone && !trimmedEmail) {
      setAddContactError(
        "Agrega al menos un teléfono o un correo para poder contactar al lead.",
      );
      return;
    }

    const candidate = {
      name: trimmedName,
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
      handle: trimmedPhone || trimmedEmail || "@nuevo_lead",
      phone: trimmedPhone,
      email: trimmedEmail,
      channel: formData.channel,
      tags: formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      sentiment: "positive" as const,
      leadScore: Math.floor(Math.random() * 30) + 65,
      stage: formData.stage,
      dealValue: Number(formData.dealValue) || 2400,
      notes: "Contacto registrado en XIO.",
      lastActive: "Ahora",
      company: formData.company.trim() || "Empresa",
    };

    const parsed = contactCreateSchema.safeParse(candidate);
    if (!parsed.success) {
      setAddContactError(
        parsed.error.issues[0]?.message || "Datos del contacto inválidos.",
      );
      return;
    }

    setAddContactError(null);
    setIsSavingContact(true);

    const error = await onAddContact(candidate);

    setIsSavingContact(false);

    if (error) {
      setAddContactError(error);
      return;
    }

    setIsAddModalOpen(false);
    setFormData({
      name: "",
      phone: "",
      email: "",
      channel: "whatsapp",
      dealValue: 2400,
      stage: "lead",
      tags: "VIP, WhatsApp, Cotización Activa",
      company: "",
    });
  };

  // Guarda qué contacto tiene el popover abierto actualmente (null = todos cerrados)
  const [openSummaryContactId, setOpenSummaryContactId] = useState<
    string | null
  >(null);
  const [summaryAnchor, setSummaryAnchor] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [dbSummaryText, setDbSummaryText] = useState<string>("");
  const [isFetchingSummary, setIsFetchingSummary] = useState<boolean>(false);

  const handleToggleDbSummary = async (
    e: React.MouseEvent<HTMLButtonElement>,
    conversationId: string | undefined,
    contactId: string,
  ) => {
    e.stopPropagation();

    if (openSummaryContactId === contactId) {
      setOpenSummaryContactId(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 320;
    const safeLeft = Math.min(rect.left, window.innerWidth - popoverWidth - 16);

    setSummaryAnchor({
      top: rect.bottom + 6,
      left: Math.max(8, safeLeft),
    });
    setOpenSummaryContactId(contactId);

    if (!conversationId) {
      setDbSummaryText(
        "Aún no existe una conversación activa para este contacto.",
      );
      return;
    }

    setIsFetchingSummary(true);
    setDbSummaryText("");

    try {
      const res = await fetch(
        `/api/conversations/${encodeURIComponent(conversationId)}/summary`,
      );
      const json = await res.json();

      if (res.ok && json.success && json.data?.summary) {
        setDbSummaryText(json.data.summary);
      } else {
        setDbSummaryText("Sin resumen disponible todavía en la base de datos.");
      }
    } catch (error) {
      setDbSummaryText("Error al consultar el resumen.");
    } finally {
      setIsFetchingSummary(false);
    }
  };
  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden font-sans">
      {/* Top Header / Stats */}
      <div className="bg-white border-b border-slate-200 px-4 lg:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <span>Embudo de Ventas Kanban - XIO</span>
            </h2>
            <span className="px-3 py-0.5 bg-emerald-50 text-emerald-800 text-xs font-extrabold rounded-full border border-emerald-300 shadow-2xs flex items-center gap-1">
              <Users className="w-3 h-3" /> {filteredContacts.length} Clientes
              Sincronizados
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5" /> Arrastra y suelta tus
            prospectos entre etapas (en móvil mantén presionado sobre la
            tarjeta).
          </p>
        </div>

        {/* Pipeline Totals & Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 border border-slate-200 rounded-2xl text-xs shadow-2xs w-full sm:w-auto justify-between">
            <div>
              <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">
                TOTAL PIPELINE:
              </span>
              <span className="font-black text-slate-900 text-sm">
                ${totalPipelineValue.toLocaleString()} USD
              </span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">
                VENTAS GANADAS:
              </span>
              <span className="font-black text-emerald-600 text-sm">
                ${totalWonValue.toLocaleString()} USD
              </span>
            </div>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-white text-emerald-700 shadow-xs scale-102"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-emerald-700 shadow-xs scale-102"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Tabla</span>
            </button>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-black shadow-sm shadow-emerald-700/20 transition-all cursor-pointer hover:scale-102 active:scale-98"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Lead / Cliente</span>
            <Sparkles className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-4 lg:px-6 py-3 bg-white border-b border-slate-200 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 w-full">
          <div className="relative w-full lg:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, tag o empresa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
            />
          </div>

          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="w-full sm:w-auto px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-extrabold focus:outline-none"
          >
            <option value="all">Todos los Canales</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="twitter">X/Twitter</option>
            <option value="messenger">Facebook</option>
          </select>
        </div>
      </div>

      {/* MAIN VIEW CONTENT */}
      <div className="flex-1 p-4 lg:p-6 overflow-y-auto overflow-x-hidden lg:overflow-x-auto">
        {viewMode === "kanban" ? (
          <>
            {/* KANBAN BOARD - DESKTOP (>= lg) */}
            <div className="hidden lg:flex gap-4 min-w-[1100px] h-full items-start">
              {stages.map((stg) => {
                const stageContacts = filteredContacts.filter(
                  (c) => c.stage === stg.id,
                );
                const stageTotal = stageContacts.reduce(
                  (acc, c) => acc + c.dealValue,
                  0,
                );
                const isDropTarget = dragOverStage === stg.id;

                return (
                  <div
                    key={stg.id}
                    data-stage-drop={stg.id}
                    onDragOver={(e) => handleDragOverColumn(e, stg.id)}
                    onDragLeave={(e) => handleDragLeaveColumn(e, stg.id)}
                    onDrop={(e) => handleDropOnColumn(e, stg.id)}
                    className={`w-72 flex flex-col max-h-full rounded-2xl border p-3.5 shrink-0 transition-all duration-150 ${
                      isDropTarget
                        ? "border-emerald-500 ring-4 ring-emerald-500/20 bg-emerald-50/70 scale-[1.01] shadow-lg"
                        : `${stg.color} ${stg.bgColor} shadow-sm`
                    }`}
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div>
                        <h3 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                          <stg.icon className="w-3.5 h-3.5" />
                          <span>{stg.label}</span>
                          <span
                            className={`w-5 h-5 rounded-full ${stg.badgeColor} text-[10px] font-black flex items-center justify-center border border-black/10 shadow-2xs`}
                          >
                            {stageContacts.length}
                          </span>
                        </h3>
                        <p className="text-[11px] font-bold text-slate-600 mt-0.5 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> $
                          {stageTotal.toLocaleString()} USD
                        </p>
                      </div>
                    </div>

                    {/* Cards List */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 pr-1 min-h-[120px]">
                      {stageContacts.length === 0 ? (
                        <div
                          className={`p-6 text-center text-xs border border-dashed rounded-2xl font-medium flex flex-col items-center gap-1.5 transition-colors ${
                            isDropTarget
                              ? "border-emerald-500 bg-emerald-100/50 text-emerald-800 font-bold"
                              : "border-slate-300 bg-white/60 text-slate-400"
                          }`}
                        >
                          <Inbox className="w-4 h-4" />
                          {isDropTarget
                            ? "Suelta aquí para mover"
                            : "Sin clientes en esta etapa"}
                        </div>
                      ) : (
                        stageContacts.map((contact) => {
                          const isBeingDragged =
                            draggedContactId === contact.id;

                          return (
                            <div
                              key={contact.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, contact)}
                              onDragEnd={handleDragEnd}
                              className={`p-3.5 bg-white border rounded-2xl transition-all space-y-2.5 group cursor-grab active:cursor-grabbing overflow-hidden ${
                                isBeingDragged
                                  ? "opacity-40 scale-95 border-emerald-500 ring-2 ring-emerald-400 shadow-inner"
                                  : "border-slate-200/90 shadow-xs hover:shadow-md hover:border-emerald-300"
                              }`}
                            >
                              {/* Top Section: Grip + Avatar + Name/Phone/Channel on Left, Monetary Value on Top Right */}
                              <div className="flex items-start justify-between gap-2 min-w-0">
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                  <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 mt-1" />
                                  <ContactAvatar
                                    name={contact.name}
                                    src={
                                      contact.avatar ||
                                      "https://cdn-icons-png.flaticon.com/512/149/149071.png"
                                    }
                                    size={38}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <h4
                                      title={contact.name}
                                      className="font-extrabold text-xs text-emerald-900 hover:text-emerald-950 transition-colors truncate"
                                    >
                                      {contact.name}
                                    </h4>
                                    <p
                                      title={contact.phone || contact.handle}
                                      className="text-[10px] text-slate-500 font-mono tracking-tight flex items-center gap-1 min-w-0"
                                    >
                                      <Smartphone className="w-2.5 h-2.5 shrink-0" />
                                      <span className="truncate">
                                        {contact.phone || contact.handle}
                                      </span>
                                    </p>
                                    <div className="mt-0.5 text-[11px] truncate">
                                      {getChannelBadge(contact.channel)}
                                    </div>
                                  </div>
                                </div>

                                <span className="text-slate-900 font-black text-[11px] shrink-0 tracking-tight bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 flex items-center gap-0.5">
                                  <DollarSign className="w-2.5 h-2.5 shrink-0" />
                                  <span>
                                    {contact.dealValue.toLocaleString()}
                                  </span>
                                </span>
                              </div>

                              {/* Resumen BD (Dentro de la card solo va el botón) */}
                              <div className="flex items-center justify-between gap-1.5 pt-0.5 min-w-0">
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.stopPropagation()} // Evita activar el drag al hacer clic en el botón
                                  onClick={(e) => {
                                    const conv = conversations.find(
                                      (c) => c.contactId === contact.id,
                                    );
                                    handleToggleDbSummary(
                                      e,
                                      conv?.id,
                                      contact.id,
                                    );
                                  }}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                                    openSummaryContactId === contact.id
                                      ? "bg-slate-800 text-white border-slate-800 shadow-xs"
                                      : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800"
                                  }`}
                                >
                                  <FileText className="w-3 h-3 shrink-0" />
                                  <span>Resumen IA</span>
                                </button>

                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-extrabold rounded-full border border-emerald-300 shadow-2xs flex items-center gap-1 shrink-0">
                                  <Star className="w-2.5 h-2.5 shrink-0" />
                                  <span>IA: {contact.leadScore}%</span>
                                </span>
                              </div>

                              {summaryData &&
                                summaryData.contactId === contact.id && (
                                  <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-xs text-slate-800 shadow-2xs rounded-xl">
                                    <div className="space-y-1.5 flex flex-col">
                                      <button
                                        onClick={() => setSummaryData(null)}
                                        aria-label="Cerrar resumen ejecutivo IA"
                                        className="text-slate-400 hover:text-slate-700 px-1 cursor-pointer self-end"
                                      >
                                        <XCircleIcon className="w-3.5 h-3.5" />
                                      </button>
                                      <div className="flex items-center gap-1.5 font-extrabold text-emerald-900 text-[11px]">
                                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate">
                                          Resumen IA (XIO + {AI_MODEL_NAME}):
                                        </span>
                                      </div>
                                      <p className="text-slate-700 leading-relaxed font-medium bg-white/60 p-2 rounded-xl border border-emerald-100 text-[11px] break-words">
                                        {summaryData.summary}
                                      </p>
                                      <div className="flex flex-col justify-center items-start gap-1 text-[10px] text-slate-700 pt-0.5 w-full break-words">
                                        <span>
                                          <strong>Intención:</strong>{" "}
                                          {summaryData.keyIntent}
                                        </span>
                                        <span>
                                          <strong>Siguiente Acción:</strong>{" "}
                                          {summaryData.suggestedNextAction}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                              {/* Tags */}
                              {contact.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 min-w-0">
                                  {contact.tags.slice(0, 2).map((t) => (
                                    <span
                                      key={t}
                                      className="max-w-full px-2 py-0.5 bg-slate-100 text-slate-800 text-[10px] rounded-md font-bold border border-slate-200 inline-flex items-center gap-1 truncate"
                                    >
                                      <Tag className="w-2.5 h-2.5 shrink-0" />
                                      <span className="truncate">{t}</span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Quick Stage Change Controls (Select contenido + botón WhatsApp) */}
                              <div className="pt-2 flex items-center justify-between gap-1.5 border-t border-slate-100 min-w-0">
                                <button
                                  onClick={() =>
                                    onSelectConversationByContactId(contact.id)
                                  }
                                  className="text-[11px] font-extrabold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 cursor-pointer shrink-0"
                                >
                                  <MessageCircle className="w-3 h-3 shrink-0" />
                                  <span>Chat</span>
                                  <ArrowRight className="w-3 h-3 shrink-0" />
                                </button>

                                <select
                                  value={contact.stage}
                                  onChange={(e) =>
                                    onUpdateStage(
                                      contact.id,
                                      e.target.value as PipelineStage,
                                    )
                                  }
                                  className="min-w-0 max-w-[140px] flex-1 text-[10px] py-1 px-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold cursor-pointer truncate focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                >
                                  <option value="lead">
                                    Mover a Prospecto
                                  </option>
                                  <option value="qualified">
                                    Mover a Cualificado
                                  </option>
                                  <option value="negotiation">
                                    Mover a Negociación
                                  </option>
                                  <option value="closed_won">
                                    Mover a Ganada
                                  </option>
                                  <option value="closed_lost">
                                    Mover a Perdida
                                  </option>
                                </select>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* KANBAN - MOBILE / TABLET (< lg): acordeón con soporte Press & Hold Drag */}
            <div className="lg:hidden space-y-3">
              {stages.map((stg) => {
                const stageContacts = filteredContacts.filter(
                  (c) => c.stage === stg.id,
                );
                const stageTotal = stageContacts.reduce(
                  (acc, c) => acc + c.dealValue,
                  0,
                );
                const isOpen = openStages.has(stg.id);
                const panelId = `stage-panel-${stg.id}`;
                const isMobileDropTarget =
                  dragOverStage === stg.id && touchDragContact != null;

                return (
                  <section
                    key={stg.id}
                    data-stage-drop={stg.id}
                    className={`rounded-2xl border transition-all ${
                      isMobileDropTarget
                        ? "border-emerald-500 ring-4 ring-emerald-500/25 bg-emerald-50/80 scale-[1.01]"
                        : `${stg.color} ${stg.bgColor}`
                    }`}
                  >
                    <h3>
                      <button
                        type="button"
                        onClick={() => toggleStage(stg.id)}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        className="w-full flex items-center justify-between gap-2 p-3.5 text-left cursor-pointer"
                      >
                        <span className="flex items-center gap-2 font-extrabold text-xs text-slate-900 min-w-0">
                          <stg.icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{stg.label}</span>
                          <span
                            className={`min-w-5 h-5 px-1 rounded-full ${stg.badgeColor} text-[10px] font-black flex items-center justify-center border border-black/10 shadow-2xs shrink-0`}
                          >
                            {stageContacts.length}
                          </span>
                          {isMobileDropTarget && (
                            <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-extrabold animate-pulse">
                              Soltar aquí
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-bold text-slate-600 hidden sm:inline">
                            ${stageTotal.toLocaleString()}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        </span>
                      </button>
                    </h3>

                    {isOpen && (
                      <div id={panelId} className="p-3.5 pt-0 space-y-3">
                        <p className="text-[11px] font-bold text-slate-600 sm:hidden">
                          ${stageTotal.toLocaleString()} USD
                        </p>
                        {stageContacts.length === 0 ? (
                          <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-300 rounded-2xl bg-white/60 font-medium">
                            {isMobileDropTarget
                              ? "Suelta para mover a esta etapa"
                              : "Sin clientes en esta etapa"}
                          </div>
                        ) : (
                          stageContacts.map((contact) => (
                            <MobileContactCard
                              key={contact.id}
                              contact={contact}
                              onUpdateStage={onUpdateStage}
                              onToggleInteraction={onToggleInteraction}
                              onSelectConversationByContactId={
                                onSelectConversationByContactId
                              }
                              onDeleteContact={onDeleteContact}
                              handleSummarizeConversation={
                                handleSummarizeConversation
                              }
                              isSummaryLoading={isSummaryLoading}
                              summaryWait={summaryWait}
                              summaryData={summaryData}
                              setSummaryData={setSummaryData}
                              conversations={conversations}
                              isBeingTouchDragged={
                                touchDragContact?.id === contact.id
                              }
                              onTouchStartCard={handleTouchStartCard}
                              onTouchMoveCard={handleTouchMoveCard}
                              onTouchEndCard={handleTouchEndCard}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            {/* Tarjeta Flotante (Ghost) durante el Press & Hold en Móvil */}
            {touchDragContact && (
              <div
                style={{
                  left: touchCoords.x - 110,
                  top: touchCoords.y - 36,
                }}
                className="fixed z-50 pointer-events-none w-56 p-3 bg-slate-900/95 text-white rounded-2xl shadow-2xl border border-emerald-400 flex items-center gap-2.5 scale-105"
              >
                <ContactAvatar
                  name={touchDragContact.name}
                  src={touchDragContact.avatar}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold truncate">
                    {touchDragContact.name}
                  </p>
                  <p className="text-[10px] text-emerald-300 font-bold truncate">
                    {dragOverStage
                      ? `Mover a: ${stages.find((s) => s.id === dragOverStage)?.label}`
                      : "Posición inválida (volverá)"}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          /* TABLE VIEW */
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> Cliente
                    </span>
                  </th>
                  <th className="p-3.5">
                    <span className="flex items-center gap-1">
                      <Smartphone className="w-3 h-3" /> Canal
                    </span>
                  </th>
                  <th className="p-3.5">
                    <span className="flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" /> Etapa Embudo
                    </span>
                  </th>
                  <th className="p-3.5">
                    <span className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Interacciones
                    </span>
                  </th>
                  <th className="p-3.5">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Valor Deal
                    </span>
                  </th>
                  <th className="p-3.5">
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3" /> Score IA
                    </span>
                  </th>
                  <th className="p-3.5">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Etiquetas
                    </span>
                  </th>
                  <th className="p-3.5 text-right">
                    <span className="flex items-center justify-end gap-1">
                      <Settings className="w-3 h-3" /> Acción
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {pagedContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="hover:bg-slate-50/90 transition-colors"
                  >
                    <td className="p-3.5 font-medium flex items-center gap-3">
                      <ContactAvatar
                        name={contact.name}
                        src={
                          contact.avatar ||
                          "https://cdn-icons-png.flaticon.com/512/149/149071.png"
                        }
                        size={36}
                      />
                      <div>
                        <div className="font-bold text-slate-900">
                          {contact.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {contact.email || contact.phone}
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 capitalize font-bold">
                      {getChannelBadge(contact.channel)}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-[11px] font-bold rounded-xl border border-slate-200 flex items-center gap-1 w-fit">
                        {contact.stage === "lead" ? (
                          <>
                            <Sprout className="w-3 h-3" /> Prospecto
                          </>
                        ) : contact.stage === "qualified" ? (
                          <>
                            <Target className="w-3 h-3" /> Cualificado
                          </>
                        ) : contact.stage === "negotiation" ? (
                          <>
                            <Briefcase className="w-3 h-3" /> Negociación
                          </>
                        ) : contact.stage === "closed_won" ? (
                          <>
                            <PartyPopper className="w-3 h-3" /> Ganada
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" /> Perdida
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleInteraction &&
                            onToggleInteraction(contact.id, "firstReply")
                          }
                          title="1era Interacción (Rojo): Respuesta positiva"
                          aria-label="1era Interacción: Respuesta positiva"
                          className={`w-5 h-3 rounded-xs cursor-pointer ${contact.interactions?.firstReply ? "bg-red-600" : "bg-slate-200"}`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onToggleInteraction &&
                            onToggleInteraction(
                              contact.id,
                              "appointmentConfirmed",
                            )
                          }
                          title="2da Interacción (Amarillo): Cita confirmada"
                          aria-label="2da Interacción: Cita confirmada"
                          className={`w-5 h-3 rounded-xs cursor-pointer ${contact.interactions?.appointmentConfirmed ? "bg-yellow-400" : "bg-slate-200"}`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onToggleInteraction &&
                            onToggleInteraction(contact.id, "proposalSent")
                          }
                          title="3ra Interacción: Propuesta enviada"
                          aria-label="3ra Interacción: Propuesta enviada"
                          className={`w-5 h-3 rounded-xs cursor-pointer ${contact.interactions?.proposalSent ? "bg-amber-500" : "bg-slate-200"}`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onToggleInteraction &&
                            onToggleInteraction(contact.id, "dealClosed")
                          }
                          title="4ta Interacción: Cierre/Pago"
                          aria-label="4ta Interacción: Cierre/Pago"
                          className={`w-5 h-3 rounded-xs cursor-pointer ${contact.interactions?.dealClosed ? "bg-emerald-600" : "bg-slate-200"}`}
                        />
                      </div>
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> $
                        {contact.dealValue.toLocaleString()} USD
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-extrabold rounded-full border border-emerald-200 flex items-center gap-1 w-fit">
                        <Star className="w-2.5 h-2.5" /> {contact.leadScore}%
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1">
                        {contact.tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] rounded-md font-bold flex items-center gap-1"
                          >
                            <Tag className="w-2.5 h-2.5" /> {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() =>
                          onSelectConversationByContactId(contact.id)
                        }
                        className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl border border-emerald-200 text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3" /> Abrir Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactToDelete(contact)}
                        title="Eliminar contacto"
                        aria-label="Eliminar contacto"
                        className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors align-middle"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              page={safeTablePage}
              pageCount={tablePageCount}
              onPageChange={setTablePage}
              total={filteredContacts.length}
              itemLabel="clientes"
              className="border-t border-slate-100 px-3"
            />
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE CONTACTO */}
      <Modal
        isOpen={contactToDelete != null}
        onClose={() => setContactToDelete(null)}
        title="Eliminar contacto"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setContactToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (contactToDelete) {
                  onDeleteContact(contactToDelete.id);
                  setContactToDelete(null);
                }
              }}
            >
              Eliminar contacto
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-md text-black">
            ¿Estás seguro de que deseas eliminar el contacto?
          </p>
          {contactToDelete && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-md font-extrabold text-red-800">
                {contactToDelete.name}
              </p>
            </div>
          )}
          <p className="text-md text-black">
            Esta acción no se puede deshacer.
          </p>
        </div>
      </Modal>

      {/* New Contact Creation Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddContactError(null);
        }}
        title="Registrar Nuevo Lead / Cliente"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsAddModalOpen(false);
                setAddContactError(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="create-contact-form"
              disabled={isSavingContact || !isNewContactFormValid}
            >
              {isSavingContact ? "Guardando..." : "Guardar Lead en CRM"}
            </Button>
          </>
        }
      >
        <form
          id="create-contact-form"
          onSubmit={handleCreateContact}
          noValidate
          className="space-y-3.5"
        >
          {addContactError && (
            <div
              className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-red-700">
                {addContactError}
              </p>
            </div>
          )}
          <Input
            label="Nombre Completo"
            required
            placeholder="Ej: Daniel Castillo"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Teléfono / WhatsApp"
              placeholder="+57 310 892..."
              className="font-mono"
              hint={
                !trimmedPhone && !trimmedEmail
                  ? "Teléfono o correo (al menos uno)"
                  : undefined
              }
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
            <Input
              label="Empresa"
              placeholder="Empresa S.A."
              value={formData.company}
              onChange={(e) =>
                setFormData({ ...formData, company: e.target.value })
              }
            />
          </div>

          <Input
            label="Correo Electrónico"
            type="email"
            placeholder="contacto@empresa.com"
            hint={
              !trimmedPhone && !trimmedEmail
                ? "Teléfono o correo (al menos uno)"
                : undefined
            }
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Canal de Origen"
              value={formData.channel}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  channel: e.target.value as SocialChannel,
                })
              }
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="twitter">X/Twitter</option>
              <option value="messenger">Messenger</option>
            </Select>
            <Input
              label="Valor Deal ($ USD)"
              type="number"
              value={formData.dealValue}
              onChange={(e) =>
                setFormData({ ...formData, dealValue: Number(e.target.value) })
              }
            />
          </div>

          <Input
            label="Etiquetas (separadas por coma)"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          />
        </form>
      </Modal>
      {/* Popover Global de Resumen IA (Fuera de las cards para no afectar el Drag & Drop ni el overflow-hidden) */}
      {openSummaryContactId && summaryAnchor && (
        <>
          {/* Capa invisible para cerrar al hacer clic afuera o al usar la rueda del mouse en el tablero */}
          <div
            className="fixed inset-0 z-[90]"
            onClick={() => setOpenSummaryContactId(null)}
            onWheel={() => setOpenSummaryContactId(null)}
          />

          {/* Tarjeta flotante posicionada exactamente debajo del botón clickeado */}
          <div
            style={{
              top: `${summaryAnchor.top}px`,
              left: `${summaryAnchor.left}px`,
            }}
            className="fixed w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3.5 z-[100] animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
                  Resumen de Conversación
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpenSummaryContactId(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1.5 py-0.5 rounded-md hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto pr-1 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap select-text">
              {isFetchingSummary ? (
                <div className="flex items-center gap-2 py-3 text-slate-400">
                  <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  <span>Consultando resumen...</span>
                </div>
              ) : (
                dbSummaryText
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
