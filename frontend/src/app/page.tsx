"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";
import {
  Play,
  RotateCw,
  Search,
  CheckCircle,
  XCircle,
  FileText,
  FileDown,
  Image,
  Clock,
  Briefcase,
  Calendar,
  Sparkles,
  Layers,
  Settings,
  Mail,
  Sliders,
  ExternalLink,
  Presentation,
  Headphones,
  Download,
} from "lucide-react";

interface ExecutionLog {
  id: string;
  agencyName: string;
  monthName: string;
  researchMode: string;
  reportMode: string;
  status: string;
  executionTime: number;
  errorMessage: string | null;
  createdAt: string;
  researchS3Key: string | null;
  pdfS3Key: string | null;
  imagesS3Key: string | null;
  researchUrl: string | null;
  pdfUrl: string | null;
  imagesUrl: string | null;
  pptxUrl?: string | null;
  podcastUrl?: string | null;
  podcastScriptUrl?: string | null;
  dealerCount?: number;
}

export default function Dashboard() {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<"dashboard" | "prompts">("dashboard");

  // Prompts States
  const [prompts, setPrompts] = useState<any[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<any | null>(null);
  const [promptContent, setPromptContent] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);

  const fetchPrompts = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/v1/prompts");
      if (!res.ok) throw new Error("Error al obtener los prompts");
      const data = await res.json();
      setPrompts(data);
      if (data.length > 0) {
        // If already selected, update its reference, otherwise pick first
        setSelectedPrompt((prev: any) => {
          const matched = data.find((d: any) => d.key === prev?.key);
          return matched || data[0];
        });
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const selectPrompt = (prompt: any) => {
    setSelectedPrompt(prompt);
    setPromptContent(prompt.content);
  };

  const handleSavePrompt = async () => {
    if (!selectedPrompt) return;
    setSavingPrompt(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`http://localhost:3000/api/v1/prompts/${selectedPrompt.key}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: promptContent,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar el prompt");
      setSuccessMsg(`Plantilla "${selectedPrompt.name}" guardada y actualizada con éxito en la base de datos.`);
      await fetchPrompts();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Error al guardar la plantilla del prompt.");
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setSavingPrompt(false);
    }
  };

  // Dealer Modal States
  const [selectedParentLogId, setSelectedParentLogId] = useState<string | null>(null);
  const [selectedParentLogAgency, setSelectedParentLogAgency] = useState<string>("");
  const [dealerLogs, setDealerLogs] = useState<any[]>([]);
  const [loadingDealers, setLoadingDealers] = useState(false);
  const [showDealersModal, setShowDealersModal] = useState(false);

  const fetchDealerLogs = async (parentLogId: string, agency: string) => {
    setSelectedParentLogId(parentLogId);
    setSelectedParentLogAgency(agency);
    setLoadingDealers(true);
    setShowDealersModal(true);
    try {
      const res = await fetch(`http://localhost:3000/api/v1/scripts/logs/${parentLogId}/dealers`);
      if (!res.ok) throw new Error("Error al obtener reportes de dealers");
      const data = await res.json();
      setDealerLogs(data);
    } catch (err: any) {
      console.error(err);
      setDealerLogs([]);
    } finally {
      setLoadingDealers(false);
    }
  };

  // Form states for executing new strategy
  const [email, setEmail] = useState("frzaragoza.arcade@gmail.com");
  const [agencyName, setAgencyName] = useState("Jetour Soueast Dealer Demo");
  const [selectedMonth, setSelectedMonth] = useState(6); // Julio (6)
  const [selectedYear, setSelectedYear] = useState(2026);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const MONTHS_SPANISH = useMemo(() => [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ], []);

  const monthName = useMemo(() => {
    return `${MONTHS_SPANISH[selectedMonth]} ${selectedYear}`;
  }, [selectedMonth, selectedYear, MONTHS_SPANISH]);

  const [researchMode, setResearchMode] = useState("Basica");
  const [reportMode, setReportMode] = useState("Triple");
  const [generateImages, setGenerateImages] = useState(true);
  const [generateSlides, setGenerateSlides] = useState(false);
  const [generatePodcast, setGeneratePodcast] = useState(false);
  const [selectedScript, setSelectedScript] = useState("demo-sales-plan");

  // Filter states
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, SUCCESS, FAILED

  // Fetch execution logs from NestJS backend
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3000/api/v1/scripts/logs");
      if (!res.ok) throw new Error("Error al obtener los logs de base de datos");
      const data = await res.json();
      setLogs(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("No se pudieron cargar los logs del servidor. Verifica que el backend esté activo en el puerto 3000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchPrompts();
  }, []);

  // Handle triggering a new strategy execution
  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setExecuting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`http://localhost:3000/api/v1/scripts/${selectedScript}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          agencyName,
          monthName,
          researchMode,
          reportMode,
          generateImages,
          generateSlides,
          generatePodcast,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setSuccessMsg(`¡Estrategia ejecutada con éxito! El reporte unificado fue enviado a ${email}.`);
        fetchLogs(); // Reload logs table
      } else {
        throw new Error(result.message || "La ejecución del script falló.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al conectar con el servidor backend.");
    } finally {
      setExecuting(false);
    }
  };

  // Computations for statistics cards
  const stats = useMemo(() => {
    const total = logs.length;
    const success = logs.filter((l) => l.status === "SUCCESS").length;
    const failed = logs.filter((l) => l.status === "FAILED").length;
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
    const avgTime =
      total > 0
        ? parseFloat((logs.reduce((acc, curr) => acc + curr.executionTime, 0) / total).toFixed(1))
        : 0;
    const lastRunMonth = logs.length > 0 ? logs[0].monthName : "Ninguno";

    return { total, success, failed, successRate, avgTime, lastRunMonth };
  }, [logs]);

  // Filtered data for table
  const filteredData = useMemo(() => {
    let result = logs;

    if (statusFilter !== "ALL") {
      result = result.filter((log) => log.status === statusFilter);
    }

    if (globalFilter.trim()) {
      const query = globalFilter.toLowerCase();
      result = result.filter(
        (log) =>
          log.agencyName.toLowerCase().includes(query) ||
          log.monthName.toLowerCase().includes(query) ||
          log.researchMode.toLowerCase().includes(query) ||
          log.reportMode.toLowerCase().includes(query)
      );
    }

    return result;
  }, [logs, globalFilter, statusFilter]);

  // Define Columns for TanStack Table
  const columns = useMemo<ColumnDef<ExecutionLog>[]>(
    () => [
      {
        accessorKey: "status",
        header: "Estatus",
        cell: (info) => {
          const status = info.getValue() as string;
          return status === "SUCCESS" ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="w-3.5 h-3.5" />
              Éxito
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <XCircle className="w-3.5 h-3.5" />
              Fallido
            </span>
          );
        },
      },
      {
        accessorKey: "agencyName",
        header: "Agencia / Distribuidor",
        cell: (info) => (
          <div>
            <div className="font-semibold text-zinc-100">{info.getValue() as string}</div>
            <div className="text-xs text-zinc-400">ID: {info.row.original.id.substring(0, 8)}...</div>
          </div>
        ),
      },
      {
        accessorKey: "monthName",
        header: "Periodo",
        cell: (info) => (
          <span className="text-zinc-300 font-medium">{info.getValue() as string}</span>
        ),
      },
      {
        accessorKey: "researchMode",
        header: "Investigación",
        cell: (info) => (
          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-xs font-mono">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "reportMode",
        header: "Modo Reporte",
        cell: (info) => (
          <span className="px-2 py-0.5 rounded bg-zinc-850 border border-zinc-800 text-zinc-400 text-xs font-mono">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Fecha de Ejecución",
        cell: (info) => {
          const date = new Date(info.getValue() as string);
          return (
            <span className="text-zinc-400 text-xs">
              {date.toLocaleDateString("es-MX", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}{" "}
              {date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
            </span>
          );
        },
      },
      {
        accessorKey: "executionTime",
        header: "Tiempo",
        cell: (info) => (
          <span className="text-zinc-300 font-mono text-xs">
            {(info.getValue() as number).toFixed(1)}s
          </span>
        ),
      },
      {
        id: "actions",
        header: "Artefactos (S3)",
        cell: (info) => {
          const log = info.row.original;
          if (log.status === "FAILED") {
            return (
              <span className="text-xs text-rose-400 font-light italic truncate max-w-[200px] block">
                {log.errorMessage || "Error desconocido"}
              </span>
            );
          }

          return (
            <div className="flex gap-2 items-center flex-wrap">
              {log.researchUrl ? (
                <a
                  href={log.researchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-all border border-zinc-800"
                  title="Descargar Investigación Completa (.MD)"
                >
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  Investigación
                </a>
              ) : (
                <span className="text-xs text-zinc-650">—</span>
              )}

              {log.pdfUrl && (
                <a
                  href={log.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-all border border-zinc-800"
                  title="Descargar Reporte Ejecutivo PDF"
                >
                  <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                  PDF Ejecutivo
                </a>
              )}

              {log.imagesUrl && (
                <a
                  href={log.imagesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-all border border-zinc-800"
                  title="Descargar Catálogo de Imágenes de Campañas"
                >
                  <Image className="w-3.5 h-3.5 text-amber-400" />
                  Catálogo
                </a>
              )}

              {log.pptxUrl && (
                <a
                  href={log.pptxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-all border border-zinc-800"
                  title="Descargar Presentación Slides PowerPoint (.PPTX)"
                >
                  <Presentation className="w-3.5 h-3.5 text-indigo-400" />
                  Slides PPTX
                </a>
              )}

              {log.podcastScriptUrl && (
                <a
                  href={log.podcastScriptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-all border border-zinc-800"
                  title="Descargar Guion del Podcast en Texto (.JSON)"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  Guion
                </a>
              )}

              {log.podcastUrl && (
                <a
                  href={log.podcastUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-all border border-zinc-800"
                  title="Descargar Audio del Podcast (.MP3)"
                >
                  <Download className="w-3.5 h-3.5 text-violet-400" />
                  Audio
                </a>
              )}

              {log.dealerCount && log.dealerCount > 0 ? (
                <button
                  onClick={() => fetchDealerLogs(log.id, log.agencyName)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 transition-all border border-indigo-900/50 cursor-pointer"
                  title="Ver Reportes por Distribuidor/Agencia"
                >
                  <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                  Dealers ({log.dealerCount})
                </button>
              ) : null}

              {log.podcastUrl && (
                <div className="flex flex-col gap-1 p-2 rounded bg-zinc-950 border border-zinc-900/80 w-full mt-2">
                  <div className="flex items-center gap-1.5">
                    <Headphones className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                      Reproducir Podcast
                    </span>
                  </div>
                  <audio
                    src={log.podcastUrl}
                    controls
                    className="w-full h-8 rounded bg-zinc-900 border border-zinc-800/80 px-1 py-0.5 text-xs opacity-90 outline-none"
                  />
                </div>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  // Initialize TanStack Table
  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 7,
      },
    },
  });

  return (
    <div className="flex-1 bg-zinc-950 text-zinc-100 min-h-screen font-sans selection:bg-indigo-500/20 selection:text-indigo-200">
      
      {/* HEADER SECTION */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
            <Sparkles className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              Jetour & Soueast
            </h1>
            <p className="text-xs text-zinc-400 font-medium">Plataforma de Investigación y Estrategia AI</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mr-auto ml-8 border-l border-zinc-900 pl-8">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-zinc-900 text-zinc-100 border border-zinc-800"
                : "text-zinc-400 hover:text-zinc-200 border border-transparent hover:bg-zinc-900/50"
            }`}
          >
            Dashboard de Estrategia
          </button>
          <button
            onClick={() => {
              setActiveTab("prompts");
              fetchPrompts();
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "prompts"
                ? "bg-zinc-900 text-zinc-100 border border-zinc-800"
                : "text-zinc-400 hover:text-zinc-200 border border-transparent hover:bg-zinc-900/50"
            }`}
          >
            Configuración de Prompts (Admin)
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all disabled:opacity-50"
            title="Refrescar logs"
          >
            <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <div className="h-4 w-[1px] bg-zinc-800" />
          <span className="text-xs font-mono text-zinc-500 bg-zinc-900 px-3 py-1.5 rounded border border-zinc-850">
            v1.2.0 (NestJS 3002)
          </span>
        </div>
      </header>

      {/* DASHBOARD CONTENT */}
      <main className="p-6 max-w-[1600px] mx-auto space-y-6">

        {/* FEEDBACK TOASTS */}
        {errorMsg && (
          <div className="p-4 rounded-lg bg-rose-950/20 border border-rose-900/30 text-rose-300 flex items-start gap-3 animate-fade-in">
            <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-bold">Error de Conexión: </span> {errorMsg}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-900/30 text-emerald-300 flex items-start gap-3 animate-fade-in">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-bold">Éxito: </span> {successMsg}
            </div>
          </div>
        )}
        
        {/* STATS OVERVIEW CARDS & DASHBOARD */}
        {activeTab === "dashboard" ? (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-900/80 backdrop-blur flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Ejecuciones Totales</p>
                  <h3 className="text-2xl font-bold mt-1 text-zinc-100">{stats.total}</h3>
                </div>
                <div className="p-3 bg-zinc-850 rounded-lg text-indigo-400 border border-zinc-800">
                  <Sliders className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-900/80 backdrop-blur flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Tasa de Éxito</p>
                  <h3 className="text-2xl font-bold mt-1 text-emerald-400">{stats.successRate}%</h3>
                </div>
                <div className="p-3 bg-zinc-850 rounded-lg text-emerald-400 border border-zinc-800">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-900/80 backdrop-blur flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Errores Totales</p>
                  <h3 className="text-2xl font-bold mt-1 text-rose-400">{stats.failed}</h3>
                </div>
                <div className="p-3 bg-zinc-850 rounded-lg text-rose-400 border border-zinc-800">
                  <XCircle className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-900/80 backdrop-blur flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Última Corrida</p>
                  <h3 className="text-sm font-semibold mt-1.5 text-zinc-300 truncate max-w-[150px]">
                    {stats.lastRunMonth || "Ninguna"}
                  </h3>
                </div>
                <div className="p-3 bg-zinc-850 rounded-lg text-zinc-400 border border-zinc-800">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-900/80 backdrop-blur flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Tiempo Promedio</p>
                  <h3 className="text-2xl font-bold mt-1 text-amber-400">{stats.avgTime}s</h3>
                </div>
                <div className="p-3 bg-zinc-850 rounded-lg text-amber-400 border border-zinc-800">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </section>

            {/* TWO-COLUMN GRID FOR FORM & LOGS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* EXECUTION CONTROL FORM (Left Column) */}
              <section className="lg:col-span-4 p-5 rounded-xl bg-zinc-900/40 border border-zinc-900/80 backdrop-blur space-y-4">
                <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Ejecutar Nueva Estrategia</h3>
                </div>

                <form onSubmit={handleExecute} className="space-y-4">
                  
                  {/* Tipo de Proceso/Estrategia */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Tipo de Proceso</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedScript("demo-sales-plan");
                          setAgencyName("Jetour Soueast Dealer Demo");
                        }}
                        className={`py-2 px-3 rounded text-xs font-bold transition-all border cursor-pointer ${
                          selectedScript === "demo-sales-plan"
                            ? "bg-indigo-600/15 border-indigo-500/50 text-indigo-300"
                            : "bg-zinc-950/60 border-zinc-900/80 text-zinc-400 hover:text-zinc-300"
                        }`}
                      >
                        Ventas & Marketing
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedScript("demo-aftersales-plan");
                          setAgencyName("Jetour Soueast Posventa Demo");
                        }}
                        className={`py-2 px-3 rounded text-xs font-bold transition-all border cursor-pointer ${
                          selectedScript === "demo-aftersales-plan"
                            ? "bg-indigo-600/15 border-indigo-500/50 text-indigo-300"
                            : "bg-zinc-950/60 border-zinc-900/80 text-zinc-400 hover:text-zinc-300"
                        }`}
                      >
                        Servicio & Posventa
                      </button>
                    </div>
                  </div>

                  {/* Target Agency */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Agencia Corporativa</label>
                    <input
                      type="text"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      className="w-full p-2.5 rounded bg-zinc-950 border border-zinc-900 focus:border-zinc-800 text-zinc-300 text-sm focus:outline-none transition-all"
                      required
                    />
                  </div>

                  {/* Period Selection (Month / Year) */}
                  <div className="space-y-1 relative">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Periodo Objetivo</label>
                    <button
                      type="button"
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      className="w-full p-2.5 rounded bg-zinc-950 border border-zinc-900 focus:border-zinc-800 text-zinc-300 text-sm text-left flex justify-between items-center focus:outline-none hover:bg-zinc-900/20 transition-all"
                    >
                      <span>{monthName}</span>
                      <Calendar className="w-4 h-4 text-zinc-500" />
                    </button>

                    {showDatePicker && (
                      <div className="absolute top-full left-0 right-0 mt-1 p-3 bg-zinc-900 border border-zinc-850 rounded shadow-xl z-20 space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Año</label>
                          <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="w-full p-2 bg-zinc-950 border border-zinc-800 text-zinc-300 rounded text-xs focus:outline-none"
                          >
                            <option value={2026}>2026</option>
                            <option value={2025}>2025</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Mes</label>
                          <div className="grid grid-cols-3 gap-1">
                            {MONTHS_SPANISH.map((mName, idx) => (
                              <button
                                key={mName}
                                type="button"
                                onClick={() => {
                                  setSelectedMonth(idx);
                                  setShowDatePicker(false);
                                }}
                                className={`p-1.5 rounded text-[11px] font-medium transition-all ${
                                  selectedMonth === idx
                                    ? "bg-indigo-600 text-white"
                                    : "bg-zinc-950 text-zinc-400 hover:text-zinc-200"
                                }`}
                              >
                                {mName.substring(0, 3)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Destination Email */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Email del Destinatario</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-2.5 pl-9 rounded bg-zinc-950 border border-zinc-900 focus:border-zinc-800 text-zinc-300 text-sm focus:outline-none transition-all"
                        placeholder="ejemplo@agencia.mx"
                        required
                      />
                      <Mail className="w-4 h-4 text-zinc-650 absolute left-3 top-3.5" />
                    </div>
                  </div>

                  {/* Research Mode */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Modo de Investigación</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Basica", "Intermedia", "Avanzada"].map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setResearchMode(mode)}
                          className={`p-2 rounded text-xs font-semibold border transition-all ${
                            researchMode === mode
                              ? "bg-indigo-950/30 border-indigo-500/50 text-zinc-100"
                              : "bg-zinc-950/60 border-zinc-900/80 text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {mode === "Basica" ? "Básica (1m)" : mode === "Intermedia" ? "Interm (7m)" : "Avanz (9m)"}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-zinc-550 leading-relaxed font-light">
                      El modo afecta la profundidad del Deep Research. Los tiempos estimados corresponden a ejecuciones frías; con caché activa es inmediato (1s).
                    </p>
                  </div>

                  {/* Generate Images Toggle */}
                  <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950/60 border border-zinc-900/80">
                    <div className="space-y-0.5">
                      <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block cursor-pointer select-none" htmlFor="generateImages">
                        Generar Imágenes AI
                      </label>
                      <span className="text-[9px] text-zinc-550 leading-relaxed font-light block">
                        Usa Imagen 4.0 para crear banners y anuncios
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      id="generateImages"
                      checked={generateImages}
                      onChange={(e) => setGenerateImages(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-800 text-indigo-650 focus:ring-indigo-500/20 bg-zinc-950 cursor-pointer"
                    />
                  </div>

                  {/* Generate Slides Toggle */}
                  <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950/60 border border-zinc-900/80">
                    <div className="space-y-0.5">
                      <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block cursor-pointer select-none" htmlFor="generateSlides">
                        Generar Slides PPTX
                      </label>
                      <span className="text-[9px] text-zinc-550 leading-relaxed font-light block">
                        Estructura y exporta el reporte a PowerPoint
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      id="generateSlides"
                      checked={generateSlides}
                      onChange={(e) => setGenerateSlides(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-800 text-indigo-650 focus:ring-indigo-500/20 bg-zinc-950 cursor-pointer"
                    />
                  </div>

                  {/* Generate Podcast Toggle */}
                  <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950/60 border border-zinc-900/80">
                    <div className="space-y-0.5">
                      <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block cursor-pointer select-none" htmlFor="generatePodcast">
                        Generar Podcast de Audio
                      </label>
                      <span className="text-[9px] text-zinc-550 leading-relaxed font-light block">
                        Crea un debate conversacional estructurado con SSML y Google TTS
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      id="generatePodcast"
                      checked={generatePodcast}
                      onChange={(e) => setGeneratePodcast(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-800 text-indigo-650 focus:ring-indigo-500/20 bg-zinc-950 cursor-pointer"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={executing}
                    className="w-full py-3 rounded bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-550 hover:to-purple-650 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {executing ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        Procesando Investigación AI...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white" />
                        Iniciar Corrida de Estrategia
                      </>
                    )}
                  </button>

                </form>
              </section>

              {/* EXECUTION HISTORY LOGS TABLE (Right Column) */}
              <section className="lg:col-span-8 p-5 rounded-xl bg-zinc-900/40 border border-zinc-900/80 backdrop-blur space-y-4">
                
                {/* Table Header / Filters */}
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-b border-zinc-900 pb-4">
                  <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Historial de Ejecuciones</h3>
                  <div className="flex gap-2">
                    {/* Status filter selection */}
                    <div className="relative">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-zinc-400 rounded px-3 py-1.5 text-xs focus:outline-none transition-all"
                      >
                        <option value="ALL">Todos los Estatus</option>
                        <option value="SUCCESS">Éxito</option>
                        <option value="FAILED">Fallidos</option>
                      </select>
                    </div>

                    {/* Global search input */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar por mes, agencia..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-zinc-300 pl-8 pr-3 py-1.5 rounded text-xs focus:outline-none transition-all placeholder:text-zinc-650"
                      />
                      <Search className="w-3.5 h-3.5 text-zinc-600 absolute left-2.5 top-2.5" />
                    </div>
                  </div>
                </div>

                {/* Table Box */}
                <div className="overflow-x-auto min-h-[300px]">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <RotateCw className="w-8 h-8 text-indigo-500 animate-spin" />
                      <p className="text-xs text-zinc-500 font-medium">Cargando base de datos...</p>
                    </div>
                  ) : filteredData.length === 0 ? (
                    <div className="text-center py-20 space-y-2 border border-dashed border-zinc-900 rounded-lg">
                      <Settings className="w-10 h-10 text-zinc-650 mx-auto" />
                      <h3 className="text-zinc-400 font-bold">No se encontraron registros</h3>
                      <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                        Aún no hay ejecuciones de estrategia que coincidan con los filtros aplicados.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                          <tr key={headerGroup.id} className="border-b border-zinc-900">
                            {headerGroup.headers.map((header) => (
                              <th
                                key={header.id}
                                className="pb-3 text-xs font-bold text-zinc-400 uppercase tracking-wider px-3"
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {table.getRowModel().rows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-zinc-900 hover:bg-zinc-900/10 transition-colors"
                          >
                            {row.getVisibleCells().map((cell) => (
                              <td key={cell.id} className="py-3.5 px-3 text-sm">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Table Pagination */}
                {!loading && filteredData.length > 0 && (
                  <div className="flex items-center justify-between border-t border-zinc-900 pt-4 text-xs">
                    <span className="text-zinc-500">
                      Mostrando {table.getRowModel().rows.length} de {filteredData.length} registros
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </section>

            </div>
          </>
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Prompts list (Left Column) */}
            <div className="lg:col-span-4 space-y-4 animate-in fade-in slide-in-from-left-4 duration-200">
              <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-900/80 backdrop-blur">
                <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-4">Plantillas Disponibles</h3>
                <div className="space-y-2">
                  {prompts.length === 0 ? (
                    <div className="flex justify-center py-8">
                      <RotateCw className="w-5 h-5 text-indigo-500 animate-spin" />
                    </div>
                  ) : (
                    prompts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPrompt(p)}
                        className={`w-full text-left p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5 ${
                          selectedPrompt?.key === p.key
                            ? "bg-indigo-950/20 border-indigo-500/50 text-zinc-100 shadow-md"
                            : "bg-zinc-950/60 border-zinc-900/80 hover:border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded w-fit uppercase">
                          {p.key}
                        </span>
                        <span className="text-sm font-bold block">{p.name}</span>
                        {p.description && (
                          <span className="text-xs text-zinc-500 font-light line-clamp-2">{p.description}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Prompt Editor (Right Column) */}
            <div className="lg:col-span-8 animate-in fade-in slide-in-from-right-4 duration-200">
              {selectedPrompt ? (
                <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-900/80 backdrop-blur space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-200">{selectedPrompt.name}</h3>
                      <p className="text-xs text-zinc-500 mt-1">{selectedPrompt.description}</p>
                    </div>
                    <span className="text-xs font-mono text-zinc-500 bg-zinc-950/60 px-3 py-1.5 rounded border border-zinc-900">
                      Clave: {selectedPrompt.key}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Cuerpo de la Plantilla (Instrucciones)</label>
                    <textarea
                      value={promptContent}
                      onChange={(e) => setPromptContent(e.target.value)}
                      className="w-full h-[550px] p-4 rounded-lg bg-zinc-950 border border-zinc-900 focus:border-zinc-700 text-zinc-300 font-mono text-xs leading-relaxed focus:outline-none resize-y selection:bg-indigo-500/20"
                      placeholder="Escribe las instrucciones del prompt aquí..."
                    />
                  </div>

                  {/* Variables Helper Box */}
                  <div className="p-3.5 rounded bg-zinc-950/60 border border-zinc-900 text-xs text-zinc-400 space-y-1.5 font-light">
                    <span className="font-bold text-zinc-350">💡 Marcadores dinámicos disponibles (serán reemplazados en tiempo de ejecución):</span>
                    {selectedPrompt.key === 'brand-strategy' ? (
                      <p className="font-mono text-[10px] text-indigo-400 bg-zinc-900/50 p-1.5 rounded leading-relaxed border border-zinc-900">
                        {"{{SALES_METRICS}}"} (métricas cuantitativas en JSON) | {"{{DEEP_RESEARCH}}"} (investigación cualitativa MD) | {"{{M1}}"}, {"{{M2}}"}, {"{{M3}}"} (nombres de los meses del trimestre)
                      </p>
                    ) : (
                      <p className="font-mono text-[10px] text-indigo-400 bg-zinc-900/50 p-1.5 rounded leading-relaxed border border-zinc-900">
                        {"{{MASTER_STRATEGY}}"} (estrategia nacional) | {"{{DIST_NAME}}"} (sucursal) | {"{{RAZON_SOCIAL}}"} | {"{{DIST_ID}}"} | {"{{CIUDAD}}"} | {"{{ESTADO}}"} | {"{{SALES_3M_2026}}"} | {"{{SALES_3M_2025}}"} | {"{{GROWTH_RATE}}"} | {"{{MONTH_NAME}}"} | {"{{SUGGESTED_GOAL}}"}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 border-t border-zinc-900 pt-4">
                    <button
                      type="button"
                      onClick={() => setPromptContent(selectedPrompt.content)}
                      className="px-4 py-2 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs rounded transition-all cursor-pointer"
                    >
                      Revertir cambios locales
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePrompt}
                      disabled={savingPrompt}
                      className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {savingPrompt ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        "Guardar Cambios"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-12 rounded-xl bg-zinc-900/40 border border-zinc-900/80 backdrop-blur text-center text-zinc-500">
                  Selecciona una plantilla del listado izquierdo para editarla.
                </div>
              )}
            </div>
          </section>
        )}

      </main>

      {/* DEALERS STRATEGY REPORTS MODAL */}
      {showDealersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-805 rounded-lg max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900 bg-zinc-900/40">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">
                    Reportes Estratégicos por Dealer / Distribuidor
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Campaña: {selectedParentLogAgency}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDealersModal(false)}
                className="p-1.5 rounded-full hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                title="Cerrar modal"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-x-auto min-h-[300px]">
              {loadingDealers ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <RotateCw className="w-8 h-8 text-indigo-500 animate-spin" />
                  <p className="text-xs text-zinc-400 font-medium">Cargando reportes por agencia...</p>
                </div>
              ) : dealerLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <XCircle className="w-10 h-10 text-zinc-700 mb-2" />
                  <p className="text-sm text-zinc-400 font-semibold">No se encontraron reportes atómicos</p>
                  <p className="text-xs text-zinc-650">No se registraron ejecuciones para los distribuidores en esta corrida.</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-semibold uppercase tracking-wider bg-zinc-900/20">
                      <th className="py-3 px-4">Estatus</th>
                      <th className="py-3 px-4">Distribuidor (ID)</th>
                      <th className="py-3 px-4">Razón Social</th>
                      <th className="py-3 px-4">Ubicación</th>
                      <th className="py-3 px-4">Tiempo</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dealerLogs.map((dLog) => (
                      <tr
                        key={dLog.id}
                        className="border-b border-zinc-900 hover:bg-zinc-900/20 transition-colors text-sm"
                      >
                        <td className="py-3 px-4">
                          {dLog.status === "SUCCESS" ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle className="w-3 h-3" />
                              Éxito
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <XCircle className="w-3 h-3" />
                              Fallido
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-zinc-200">{dLog.dealerName}</div>
                          <div className="text-xs text-zinc-500">ID: {dLog.dealerId}</div>
                        </td>
                        <td className="py-3 px-4 text-zinc-300 text-xs max-w-[150px] truncate" title={dLog.razonSocial}>
                          {dLog.razonSocial}
                        </td>
                        <td className="py-3 px-4 text-zinc-300 text-xs">
                          {dLog.ciudad && dLog.estado ? `${dLog.ciudad}, ${dLog.estado}` : dLog.estado || dLog.ciudad || "No especificada"}
                        </td>
                        <td className="py-3 px-4 text-zinc-400 font-mono text-xs">
                          {dLog.executionTime}s
                        </td>
                        <td className="py-3 px-4 text-right">
                          {dLog.status === "SUCCESS" && dLog.pdfUrl ? (
                            <a
                              href={dLog.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-all border border-zinc-800"
                              title="Descargar PDF de Agencia"
                            >
                              <FileDown className="w-3.5 h-3.5 text-indigo-400" />
                              Descargar PDF
                            </a>
                          ) : dLog.status === "FAILED" ? (
                            <span className="text-xs text-rose-400 italic" title={dLog.errorMessage}>
                              {dLog.errorMessage || "Error en generación"}
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-900 bg-zinc-900/20 flex justify-end">
              <button
                onClick={() => setShowDealersModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-850 hover:border-zinc-700 text-xs transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
