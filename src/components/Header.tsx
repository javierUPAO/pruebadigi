import React, { useEffect, useRef, useState } from 'react';
import {
  Bell, Search, Radio, Sparkles, Github, Menu, X,
  MessageCircle, LayoutGrid, Target, Megaphone, Zap, TrendingUp, Plug, Rocket, Puzzle,
  LogOut,
  User,
  MessageSquare,
  Instagram,
  Twitter,
  ChevronRight
} from 'lucide-react';
import { Conversation } from '@/types';
import { AI_MODEL_NAME, XIO_EXTENSION_VERSION } from '@/lib/constants';

type WhatsAppStatusType = 'active-session' | 'active-no-session' | 'inactive';

interface HeaderProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onSimulateIncomingMessage: () => void;
  onOpenGithubModal: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onToggleSidebar: () => void;
  onLogout: () => void
  conversations: Conversation[],
  whatsappStatus: WhatsAppStatusType;
  onConnectWhatsapp: () => void;
  onSelectConversationByContactId: (contactId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
   activeTab,
  onSimulateIncomingMessage,
  onOpenGithubModal,
  searchQuery,
  setSearchQuery,
  onToggleSidebar,
  onLogout,
  conversations,
  whatsappStatus,
  onConnectWhatsapp,
  onSelectConversationByContactId
}) => {
  const getTabInfo = (tab: string) => {
    switch (tab) {
      case 'inbox':
        return {
          icon: MessageCircle,
          title: 'Inbox Omnicanal - XIO',
          subtitle: 'WhatsApp Web Multiagente, Instagram & Chat IA'
        };
      case 'contacts':
        return {
          icon: LayoutGrid,
          title: 'CRM Kanban de Ventas & Funnel',
          subtitle: 'Pipeline interactivo y seguimiento de prospectos en tiempo real'
        };
      case 'segments':
        return {
          icon: Target,
          title: 'Segmentos & Audiencias IA',
          subtitle: 'Filtros avanzados por canal, score y etiquetas'
        };
      case 'campaigns':
        return {
          icon: Megaphone,
          title: 'Difusión Masiva & Copywriter IA',
          subtitle: 'Campañas de marketing automatizadas con Google Gemini'
        };
      case 'automation':
        return {
          icon: Zap,
          title: 'Automatizaciones & Flujos',
          subtitle: 'Disparadores inteligentes y auto-respondedores 24/7'
        };
      case 'analytics':
        return {
          icon: TrendingUp,
          title: 'Métricas, Analítica & Rendimiento',
          subtitle: 'Cuadros de mando, conversiones y tiempos de respuesta'
        };
      case 'api-github':
        return {
          icon: Plug,
          title: 'API REST, Webhooks & MongoDB',
          subtitle: 'Playground interactivo y gestión de bases de datos'
        };
      default:
        return {
          icon: Rocket,
          title: 'XIO',
          subtitle: 'Plataforma Omnicanal de Ventas'
        };
    }
  };

  const currentTab = getTabInfo(activeTab);

  // Busqueda en viewports <lg: el campo del Header esta oculto, asi que un
  // icono despliega una barra de busqueda a pantalla completa sobre el Header.
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showUserOptions, setShowUserOptions] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);
  const [loadItems, setLoadItems] = useState(2)
  const unread = conversations.filter(c => c.unreadCount > 0)
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showMobileSearch) mobileSearchRef.current?.focus();
  }, [showMobileSearch]);

  return (
    <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-3 md:px-6 flex items-center justify-between gap-2 sticky top-0 z-30 shadow-xs">
      {/* Title & Connection Badges */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {/* Sidebar Toggle */}
        <button
          onClick={onToggleSidebar}
          className="p-2 -ml-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm md:text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2 truncate">
            <currentTab.icon className="w-4 h-4 md:w-4.5 md:h-4.5 text-emerald-600 shrink-0" />
            <span className="truncate">{currentTab.title}</span>
          </h1>
          <div className="flex items-center gap-2.5 text-[11px] text  -slate-500 mt-0.5">
                        <button
              type="button"
              onClick={onConnectWhatsapp}
              className={`hidden sm:inline-flex items-center gap-1.5 font-bold px-2 py-0.5 rounded-full border transition-colors ${
                whatsappStatus === 'active-session'
                  ? 'text-emerald-600 bg-emerald-50 border-emerald-200/60'
                  : whatsappStatus === 'active-no-session'
                  ? 'text-amber-600 bg-amber-50 border-amber-200/60'
                  : 'text-red-600 bg-red-50 border-red-200/60 hover:bg-red-100'
              }`}

            >
              <span className={`w-2 h-2 rounded-full ${
                whatsappStatus === 'active-session'
                  ? 'bg-emerald-500'
                  : whatsappStatus === 'active-no-session'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-red-500'
              }`}></span>
              {whatsappStatus === 'active-session'
                ? 'WhatsApp Activo: Con sesión'
                : whatsappStatus === 'active-no-session'
                ? 'WhatsApp Activo: Sin sesión'
                : 'Servicio de WhatsApp inactivo'}
            </button>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="hidden md:inline-flex items-center gap-1 font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              <Puzzle className="w-3 h-3" /> Extensión XIO v{XIO_EXTENSION_VERSION}
            </span>
            <span className="text-slate-300 hidden lg:inline">•</span>
            <span className="hidden lg:inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/60">
              <Sparkles className="w-3 h-3" /> {AI_MODEL_NAME} IA
            </span>
          </div>
        </div>
      </div>

      {/* Global Actions.
          min-w-0 + overflow-x-auto: red de seguridad -- si en algun ancho
          este grupo no cabe (varios botones con texto visibles a la vez),
          se vuelve desplazable en vez de quedar recortado en silencio por
          el overflow-x:hidden del body (que era justo lo que pasaba con
          el boton "GitHub Studio" en anchos tipo tablet, ~768px). */}
      <div className="flex items-center gap-1 md:gap-3 min-w-0">
        {/* Search Bar (>= lg) */}
        <div className="relative hidden lg:block w-60 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar contacto, tag, teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
          />
        </div>

        {/* Search Toggle (< lg) */}
        <button
          type="button"
          onClick={() => setShowMobileSearch(true)}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
          aria-label="Buscar"
          aria-expanded={showMobileSearch}
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Incoming Message Simulator Button */}
        <button
          onClick={onSimulateIncomingMessage}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer group shrink-0"
          title="Simular llegada de mensaje entrante a WhatsApp"
          aria-label="Simular llegada de mensaje entrante a WhatsApp"
        >
          <Radio className="w-3.5 h-3.5 group-hover:scale-125 transition-transform" />
          <span className="hidden sm:inline">Simular Mensaje</span>
          <span className="hidden md:inline-flex items-center gap-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-md text-white"><Sparkles className="w-2.5 h-2.5" /> IA</span>
        </button>

        {/* GitHub Export / Download Button.
            El texto ahora aparece recien en lg (antes en md, al mismo tiempo
            que "Simular Mensaje" + badge IA), para no competir por espacio
            justo en el rango de anchos mas apretado (tablets, ~768-1023px). */}
        <button
          onClick={onOpenGithubModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer hover:border-slate-300 shrink-0"
          title="Exportar proyecto para GitHub"
          aria-label="Exportar proyecto para GitHub"
        >
          <Github className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">GitHub Studio</span>
        </button>
                {/* Botón de conexión WhatsApp, solo visible en móvil (en desktop ya está el badge de arriba) */}
        <button
          type="button"
          onClick={onConnectWhatsapp}
          aria-label={
            whatsappStatus === 'active-session'
              ? 'WhatsApp activo con sesión'
              : whatsappStatus === 'active-no-session'
              ? 'WhatsApp activo sin sesión'
              : 'Conectar WhatsApp'
          }
          className={`sm:hidden flex items-center justify-center w-9 h-9 rounded-xl transition-colors cursor-pointer shrink-0 ${
            whatsappStatus === 'active-session'
              ? 'text-emerald-600 bg-emerald-50'
              : whatsappStatus === 'active-no-session'
              ? 'text-amber-600 bg-amber-50'
              : 'text-red-600 bg-red-50 hover:bg-red-100'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <div ref={notificationsRef} className='relative flex justify-center'>
          <button aria-label="Ver notificaciones" onClick={() => {
            setShowNotifications(!showNotifications)
            setShowUserOptions(false)
          }} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors relative cursor-pointer shrink-0">
            <Bell className="w-4 h-4" />
            {unread.length > 0 && (
              <span className="w-2 h-2 bg-emerald-500 rounded-full absolute top-1.5 right-1.5 ring-2 ring-white"></span>
            )}
          </button>

          {showNotifications && (
            <div className="hidden md:flex md:flex-col absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl z-50">

              {unread.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <MessageSquare className="w-6 h-6 mx-auto mb-1" />
                  Bandeja de notificaciones vacia
                </div>
              ) : (
                unread.slice(0, loadItems).map(conv => {
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => {
                        onSelectConversationByContactId(conv.contactId)
                        setShowNotifications(false)
                      }}
                      className='w-full text-left bg-white p-2 border-b border-slate-100 text-slate-600 cursor-pointer hover:bg-slate-50/90 flex gap-2'
                    >
                      <div className="relative shrink-0">
                        <img
                          src={conv.contact.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                          alt={conv.contact.name}
                          className="w-11 h-11 rounded-2xl object-cover border border-slate-200 shadow-2xs"
                        />
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-2xs border border-slate-100">
                          {conv.channel === 'whatsapp' ? <MessageCircle className="w-2.5 h-2.5 text-emerald-600" /> : conv.channel === 'instagram' ? <Instagram className="w-2.5 h-2.5 text-pink-600" /> : conv.channel === 'twitter' ? <Twitter className="w-2.5 h-2.5 text-sky-600" /> : <MessageSquare className="w-2.5 h-2.5 text-blue-600" />}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className="font-extrabold text-xs text-slate-900 truncate">
                            {conv.contact.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                            {conv.lastMessageTime}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 truncate mb-1.5 font-medium">
                          {conv.lastMessage}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
              <button
                type="button"
                onClick={() => {
                  setLoadItems((prev) => prev + 2)
                }}
                className={`${loadItems >= unread.length ? 'hidden' : 'flex'} cursor-pointer font-bold items-center justify-center gap-2 w-full p-3 text-slate-600 text-xs shrink-0 hover:bg-slate-50`}
                aria-label="Cargar más notificaciones"
              >
                Cargar más mensajes <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>

        <div className='group relative flex justify-center items-center'>
          <button
            type="button"
            onClick={() => setShowUserOptions(!showUserOptions)}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
            aria-label="Opciones de usuario"
            aria-expanded={showUserOptions}
          >
            <User className="w-4 h-4" />
          </button>

          <button
            onClick={onLogout}
            aria-label="Cerrar sesión" className={`z-25
            absolute ml-1 p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl  
              transition-colors cursor-pointer shrink-0 top-full mt-1 md:top-auto md:mt-0
            ${showUserOptions ? 'block' : 'hidden'} 
            md:hidden md:group-hover:block
            `}>
            <LogOut className="w-4 h-4" />
          </button>
        </div>

      </div>


      {/* Expanded Search Bar (< lg) */}
      {showMobileSearch && (
        <div className="absolute inset-0 z-20 flex items-center gap-2 bg-white px-3 lg:hidden">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={mobileSearchRef}
              type="text"
              placeholder="Buscar contacto, tag, teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setShowMobileSearch(false); }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowMobileSearch(false)}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showNotifications && (
        <div className="absolute h-screen inset-x-0 top-0 z-20 flex flex-col bg-white md:hidden">
          <button
            type="button"
            onClick={() => {
              setLoadItems(2)
              setShowNotifications(false)
            }}
            className="mb-4 font-bold flex gap-2 items-center w-full p-4 text-slate-500 rounded-b-xl shrink-0 shadow-lg"
            aria-label="Cerrar búsqueda"
          >
            <X className="w-4 h-4" /> Notificaciones
          </button>

          {unread.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <MessageSquare className="w-6 h-6 mx-auto mb-1" />
              Bandeja de notificaciones vacia
            </div>
          ) : (
            unread.slice(0, loadItems).map(conv => {
              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    onSelectConversationByContactId(conv.contactId)
                    setShowNotifications(false)
                  }}
                  className='w-full text-left bg-white p-2 border border-slate-200 text-slate-600'
                >
                  <div className="relative shrink-0">
                    <img
                      src={conv.contact.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                      alt={conv.contact.name}
                      className="w-11 h-11 rounded-2xl object-cover border border-slate-200 shadow-2xs"
                    />
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-2xs border border-slate-100">
                      {conv.channel === 'whatsapp' ? <MessageCircle className="w-2.5 h-2.5 text-emerald-600" /> : conv.channel === 'instagram' ? <Instagram className="w-2.5 h-2.5 text-pink-600" /> : conv.channel === 'twitter' ? <Twitter className="w-2.5 h-2.5 text-sky-600" /> : <MessageSquare className="w-2.5 h-2.5 text-blue-600" />}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="font-extrabold text-xs text-slate-900 truncate">
                        {conv.contact.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                        {conv.lastMessageTime}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 truncate mb-1.5 font-medium">
                      {conv.lastMessage}
                    </p>
                  </div>
                </button>
              );
            })
          )}

          <button
            type="button"
            onClick={() => {
              setLoadItems((prev) => prev + 2)
            }}
            className={`${loadItems >= unread.length ? 'hidden' : 'flex'} mt-4 font-bold gap-2 items-center w-full p-4 text-black rounded-t-xl shrink-0`}
            aria-label="Cerrar búsqueda"
          >
            Cargar más mensajes <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
};