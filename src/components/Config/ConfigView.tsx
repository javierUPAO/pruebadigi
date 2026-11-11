"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  CornerDownRight,
  Layers,
  Tag,
  X,
  Settings,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export interface CategoryItem {
  id_categoria: number;
  nombre: string;
  tipo: number; // 1: Categoría, 0: Subcategoría
  padre_id: number | null;
  subcategorias?: CategoryItem[];
}

export const ConfigView: React.FC = () => {
  // Sección activa dentro de Configuraciones (preparado para crecer en el futuro)
  const [activeSection, setActiveSection] =
    useState<"categories">("categories");

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Feedback Banner (Éxito / Error)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Modal Crear (con 2 tabs: categoria | subcategoria)
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [createTab, setCreateTab] = useState<"categoria" | "subcategoria">(
    "categoria",
  );
  const [createNombre, setCreateNombre] = useState<string>("");
  const [createPadreId, setCreatePadreId] = useState<string>("");
  const [parentOptions, setParentOptions] = useState<CategoryItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Modal Editar
  const [editTarget, setEditTarget] = useState<CategoryItem | null>(null);
  const [editNombre, setEditNombre] = useState<string>("");
  const [editPadreId, setEditPadreId] = useState<string>("");

  // Modal Eliminar
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);

  // Auto-ocultar notificación después de 4.5s
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4500);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Cargar árbol de categorías y subcategorías
  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/categories");
      const body = await res.json();
      if (res.ok && body.success) {
        setCategories(body.data || []);
      } else {
        setFeedback({
          type: "error",
          text: body.error || "No se pudieron cargar las categorías.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al cargar las categorías.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Llamada específica al backend para cargar solo nombres e IDs de categorías padre (tipo=1)
  const fetchParentCategoriesOnly = async () => {
    try {
      const res = await apiFetch("/api/categories?tipo=1");
      const body = await res.json();
      if (res.ok && body.success && Array.isArray(body.data)) {
        setParentOptions(body.data);
        if (body.data.length > 0 && !createPadreId) {
          setCreatePadreId(String(body.data[0].id_categoria));
        }
      }
    } catch {
      // Fallback a las categorías ya cargadas en memoria
      setParentOptions(categories);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Cuando se abre el modal de crear o se cambia al tab de subcategoría, consultamos los padres
  useEffect(() => {
    if (isCreateOpen && createTab === "subcategoria") {
      fetchParentCategoriesOnly();
    }
  }, [isCreateOpen, createTab]);

  // Filtrado por buscador (filtra por nombre de categoría o subcategoría)
  const filteredCategories = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return categories;

    return categories
      .map((cat) => {
        const parentMatches = cat.nombre.toLowerCase().includes(q);
        const matchingSubs = (cat.subcategorias || []).filter((sub) =>
          sub.nombre.toLowerCase().includes(q),
        );

        if (parentMatches) {
          return cat; // Muestra la categoría con todas sus hijas
        }
        if (matchingSubs.length > 0) {
          return { ...cat, subcategorias: matchingSubs };
        }
        return null;
      })
      .filter(Boolean) as CategoryItem[];
  }, [categories, searchTerm]);

  // Abrir modal de creación
  const handleOpenCreate = (
    initialTab: "categoria" | "subcategoria" = "categoria",
    preselectedParentId?: number,
  ) => {
    setModalError(null);
    setCreateNombre("");
    setCreateTab(initialTab);
    if (preselectedParentId) {
      setCreatePadreId(String(preselectedParentId));
    } else if (categories.length > 0) {
      setCreatePadreId(String(categories[0].id_categoria));
    }
    setIsCreateOpen(true);
  };

  // Enviar creación
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const nombreTrim = createNombre.trim();
    if (!nombreTrim) {
      setModalError("Por favor, ingresa un nombre válido.");
      return;
    }

    const tipo = createTab === "categoria" ? 1 : 0;
    if (tipo === 0 && !createPadreId) {
      setModalError("Debes seleccionar una categoría principal.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombreTrim,
          tipo,
          padre_id: tipo === 0 ? Number(createPadreId) : null,
        }),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        setModalError(body.error || "Error al crear el registro.");
        return;
      }

      setFeedback({
        type: "success",
        text:
          body.message ||
          `Se ha creado la ${
            tipo === 1 ? "categoría" : "subcategoría"
          } correctamente.`,
      });
      setIsCreateOpen(false);
      setCreateNombre("");
      await fetchCategories();
    } catch {
      setModalError("Error de red al intentar guardar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir modal de edición
  const handleOpenEdit = (item: CategoryItem) => {
    setModalError(null);
    setEditTarget(item);
    setEditNombre(item.nombre);
    setEditPadreId(item.padre_id ? String(item.padre_id) : "");
    if (item.tipo === 0) {
      fetchParentCategoriesOnly();
    }
  };

  // Enviar edición
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setModalError(null);

    const nombreTrim = editNombre.trim();
    if (!nombreTrim) {
      setModalError("El nombre no puede estar vacío.");
      return;
    }

    if (editTarget.tipo === 0 && !editPadreId) {
      setModalError("Debes seleccionar una categoría padre.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_categoria: editTarget.id_categoria,
          nombre: nombreTrim,
          tipo: editTarget.tipo,
          padre_id: editTarget.tipo === 0 ? Number(editPadreId) : null,
        }),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        setModalError(body.error || "Error al modificar el registro.");
        return;
      }

      setFeedback({
        type: "success",
        text:
          body.message ||
          `Se ha modificado la ${
            editTarget.tipo === 1 ? "categoría" : "subcategoría"
          } correctamente.`,
      });
      setEditTarget(null);
      await fetchCategories();
    } catch {
      setModalError("Error de conexión al modificar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmar eliminación
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);

    try {
      const res = await apiFetch(
        `/api/categories?id=${deleteTarget.id_categoria}`,
        {
          method: "DELETE",
        },
      );
      const body = await res.json();

      if (!res.ok || !body.success) {
        setFeedback({
          type: "error",
          text: body.error || "No se pudo eliminar el registro.",
        });
        setDeleteTarget(null);
        return;
      }

      setFeedback({
        type: "success",
        text:
          body.message ||
          `Se ha eliminado la ${
            deleteTarget.tipo === 1 ? "categoría" : "subcategoría"
          } correctamente.`,
      });
      setDeleteTarget(null);
      await fetchCategories();
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al intentar eliminar.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCategorias = categories.length;
  const totalSubcategorias = categories.reduce(
    (acc, cat) => acc + (cat.subcategorias?.length || 0),
    0,
  );

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
      {/* Sub-navegación de Configuraciones (Escalable para futuras secciones) */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-8 pt-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            <Settings className="w-3.5 h-3.5 text-emerald-600" />
            <span>Panel de Configuración del Sistema</span>
          </div>
          <div className="flex items-center gap-6 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveSection("categories")}
              className={`pb-3 text-xs md:text-sm font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeSection === "categories"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FolderTree className="w-4 h-4" />
              <span>Gestión de Categorías</span>
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-100 text-emerald-800 font-bold">
                {totalCategorias + totalSubcategorias}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto space-y-5">
        {/* Toast / Banner de Respuesta */}
        {feedback && (
          <div
            role="alert"
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border shadow-sm text-xs md:text-sm font-semibold transition-all ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Cabecera de Acción y Búsqueda */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base md:text-lg font-extrabold text-slate-900 truncate">
              Catálogo de Categorías y Subcategorías
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Administra las categorías principales ({totalCategorias}) y sus
              subcategorías ({totalSubcategorias}) para clasificar servicios y
              botones rápidos.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrar categoría o subcategoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-56 pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium transition-all"
              />
            </div>

            <button
              type="button"
              onClick={() => handleOpenCreate("categoria")}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Nueva Categoría / Subcategoría</span>
            </button>
          </div>
        </div>

        {/* Estado de Carga */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
            <span className="text-xs font-semibold">
              Cargando estructura de categorías...
            </span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <FolderTree className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-700">
                No se encontraron categorías
              </p>
              <p className="text-xs text-slate-500">
                {searchTerm
                  ? `No hay resultados para "${searchTerm}".`
                  : "Comienza creando tu primera categoría principal."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* =========================================================
                VISTA DESKTOP: Tabla Jerárquica (>= md)
               ========================================================= */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-200 text-[11px] font-extrabold uppercase tracking-wider">
                    <th className="py-3.5 px-5">
                      Nombre de Categoría / Subcategoría
                    </th>
                    <th className="py-3.5 px-4 w-40">Tipo</th>
                    <th className="py-3.5 px-4 w-56">Categoría Padre</th>
                    <th className="py-3.5 px-5 w-44 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredCategories.map((cat) => (
                    <React.Fragment key={cat.id_categoria}>
                      {/* Fila de Categoría Principal */}
                      <tr className="bg-slate-50/90 hover:bg-slate-100/80 transition-colors">
                        <td className="py-3.5 px-5 font-extrabold text-slate-900 flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-emerald-600/10 border border-emerald-500/30 text-emerald-700 flex items-center justify-center shrink-0">
                            <Layers className="w-3.5 h-3.5" />
                          </span>
                          <span>{cat.nombre}</span>
                          <span className="ml-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-200/80 text-slate-700">
                            {cat.subcategorias?.length || 0} subcategorías
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Categoría
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-medium">
                          — Principal —
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenCreate(
                                  "subcategoria",
                                  cat.id_categoria,
                                )
                              }
                              title="Añadir subcategoría a esta categoría"
                              className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg transition-colors cursor-pointer"
                            >
                              + Sub
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(cat)}
                              title="Editar categoría"
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(cat)}
                              title="Eliminar categoría"
                              className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Filas de Subcategorías Hijas */}
                      {(cat.subcategorias || []).map((sub) => (
                        <tr
                          key={sub.id_categoria}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-2.5 pl-11 pr-5 font-semibold text-slate-700 flex items-center gap-2">
                            <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <Tag className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span>{sub.nombre}</span>
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                              Subcategoría
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 font-semibold truncate max-w-[200px]">
                            {cat.nombre}
                          </td>
                          <td className="py-2.5 px-5 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenEdit({
                                    ...sub,
                                    padre_id: sub.padre_id ?? cat.id_categoria,
                                  })
                                }
                                title="Editar subcategoría"
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(sub)}
                                title="Eliminar subcategoría"
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* =========================================================
                VISTA MÓVIL: Cards Jerárquicas (< md)
               ========================================================= */}
            <div className="md:hidden space-y-3.5">
              {filteredCategories.map((cat) => (
                <div
                  key={cat.id_categoria}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                >
                  {/* Cabecera de la Card (Categoría Padre) */}
                  <div className="p-4 bg-slate-900 text-white flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="inline-block text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-1">
                        Categoría Principal
                      </span>
                      <h3 className="font-extrabold text-sm leading-snug break-words">
                        {cat.nombre}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(cat)}
                        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl"
                        aria-label="Editar categoría"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(cat)}
                        className="p-2 text-rose-400 hover:text-rose-300 hover:bg-slate-800 rounded-xl"
                        aria-label="Eliminar categoría"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Lista de Subcategorías dentro de la Card */}
                  <div className="divide-y divide-slate-100">
                    {(cat.subcategorias || []).length === 0 ? (
                      <div className="p-4 text-xs text-slate-400 italic flex items-center justify-between">
                        <span>Sin subcategorías registradas</span>
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenCreate("subcategoria", cat.id_categoria)
                          }
                          className="text-emerald-600 font-bold not-italic"
                        >
                          + Agregar
                        </button>
                      </div>
                    ) : (
                      (cat.subcategorias || []).map((sub) => (
                        <div
                          key={sub.id_categoria}
                          className="px-4 py-3 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs font-semibold text-slate-700 break-words">
                              {sub.nombre}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenEdit({
                                  ...sub,
                                  padre_id: sub.padre_id ?? cat.id_categoria,
                                })
                              }
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
                              aria-label="Editar subcategoría"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(sub)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg"
                              aria-label="Eliminar subcategoría"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Pie de Card para añadir Subcategoría rápido */}
                  {(cat.subcategorias || []).length > 0 && (
                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenCreate("subcategoria", cat.id_categoria)
                        }
                        className="text-xs font-bold text-emerald-700 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Añadir subcategoría</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* =========================================================
          MODAL 1: CREAR (Con 2 Tabs: Categoría / Subcategoría)
         ========================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm">
                Nuevo Registro en Catálogo
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selector de 2 Tabs */}
            <div className="grid grid-cols-2 bg-slate-100 p-1.5 m-4 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setCreateTab("categoria");
                  setModalError(null);
                }}
                className={`py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  createTab === "categoria"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Categoría
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateTab("subcategoria");
                  setModalError(null);
                }}
                className={`py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  createTab === "subcategoria"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Subcategoría
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="px-5 pb-5 space-y-4">
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {createTab === "subcategoria" && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Categoría Principal (Padre)
                  </label>
                  <select
                    value={createPadreId}
                    onChange={(e) => setCreatePadreId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    {parentOptions.length === 0 ? (
                      <option value="">No hay categorías disponibles</option>
                    ) : (
                      parentOptions.map((p) => (
                        <option key={p.id_categoria} value={p.id_categoria}>
                          {p.nombre}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {createTab === "categoria"
                    ? "Nombre de la Categoría"
                    : "Nombre de la Subcategoría"}
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder={
                    createTab === "categoria"
                      ? "Ej: DISEÑO Y DESARROLLO WEB"
                      : "Ej: Landing Page"
                  }
                  value={createNombre}
                  onChange={(e) => setCreateNombre(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (createTab === "subcategoria" && parentOptions.length === 0)
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>
                    Crear{" "}
                    {createTab === "categoria" ? "Categoría" : "Subcategoría"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 2: EDITAR CATEGORÍA O SUBCATEGORÍA
         ========================================================= */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm">
                Editar {editTarget.tipo === 1 ? "Categoría" : "Subcategoría"}
              </h3>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {editTarget.tipo === 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Categoría Padre
                  </label>
                  <select
                    value={editPadreId}
                    onChange={(e) => setEditPadreId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    {parentOptions.map((p) => (
                      <option key={p.id_categoria} value={p.id_categoria}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Nombre
                </label>
                <input
                  type="text"
                  autoFocus
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 3: CONFIRMAR ELIMINACIÓN (Lista subcategorías si es Padre)
         ========================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-sm text-slate-900">
                    ¿Eliminar{" "}
                    {deleteTarget.tipo === 1 ? "categoría" : "subcategoría"}?
                  </h3>
                  <p className="text-xs text-slate-600">
                    Estás a punto de eliminar{" "}
                    <span className="font-extrabold text-slate-900">
                      "{deleteTarget.nombre}"
                    </span>
                    . Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>

              {/* Si es categoría padre y tiene subcategorías, las listamos explícitamente */}
              {deleteTarget.tipo === 1 &&
                deleteTarget.subcategorias &&
                deleteTarget.subcategorias.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-950 space-y-2">
                    <p className="text-xs font-extrabold flex items-center gap-1.5 text-amber-900">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      <span>
                        Atención: Esto también eliminará las siguientes{" "}
                        {deleteTarget.subcategorias.length} subcategorías:
                      </span>
                    </p>
                    <ul className="max-h-36 overflow-y-auto pl-4 space-y-1 text-xs font-semibold text-amber-900 list-disc">
                      {deleteTarget.subcategorias.map((sub) => (
                        <li key={sub.id_categoria}>{sub.nombre}</li>
                      ))}
                    </ul>
                  </div>
                )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Sí, eliminar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
