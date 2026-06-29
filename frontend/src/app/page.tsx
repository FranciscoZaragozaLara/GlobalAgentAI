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
  dealerCount?: number;
}

export default function Dashboard() {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
  }, []);

  // Handle triggering a new strategy execution
  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setExecuting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("http://localhost:3000/api/v1/scripts/demo-sales-plan/execute", {
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

    return { total, success, failed, successRate, avgTime };
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

        {/* STATS OVERVIEW CARDS */}
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
              <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Promedio de Proceso</p>
              <h3 className="text-2xl font-bold mt-1 text-zinc-100 font-mono">{stats.avgTime}s</h3>
            </div>
            <div className="p-3 bg-zinc-850 rounded-lg text-zinc-400 border border-zinc-800">
              <Clock className="w-5 h-5 text-indigo-400" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-900/80 backdrop-blur flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Servicio AWS S3</p>
              <h3 className="text-2xl font-bold mt-1 text-sky-400">Activo</h3>
            </div>
            <div className="p-3 bg-zinc-850 rounded-lg text-sky-400 border border-zinc-800">
              <ExternalLink className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* TWO COLUMN INTERFACE (FORM + TABLE) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* TRIGGER FORM PANEL */}
          <section className="lg:col-span-1 p-5 rounded-xl bg-zinc-900/30 border border-zinc-900 backdrop-blur space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
              <Play className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Ejecutar Nueva Estrategia</h2>
            </div>

            <form onSubmit={handleExecute} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 font-semibold mb-1">Nombre de la Agencia</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500/50 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none text-zinc-200 placeholder-zinc-600"
                    placeholder="Jetour Soueast Dealer Demo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-zinc-400 font-semibold mb-1">Mes / Periodo</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500/50 rounded-lg py-2.5 px-3 text-xs focus:outline-none text-zinc-200 flex items-center justify-between cursor-pointer gap-1.5 min-w-0"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                        <span className="truncate">{MONTHS_SPANISH[selectedMonth]} {selectedYear}</span>
                      </div>
                      <span className="text-zinc-500 text-[10px] flex-shrink-0">▼</span>
                    </button>

                    {showDatePicker && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowDatePicker(false)}
                        />
                        <div className="absolute left-0 mt-2 p-3 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-20 w-64">
                          <div className="flex items-center justify-between border-b border-zinc-850 pb-2 mb-2">
                            <button
                              type="button"
                              onClick={() => setSelectedYear(prev => prev - 1)}
                              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-all text-xs font-bold"
                            >
                              &larr;
                            </button>
                            <span className="text-sm font-bold text-zinc-200">{selectedYear}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedYear(prev => prev + 1)}
                              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-all text-xs font-bold"
                            >
                              &rarr;
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-1">
                            {MONTHS_SPANISH.map((m, idx) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => {
                                  setSelectedMonth(idx);
                                  setShowDatePicker(false);
                                }}
                                className={`py-1.5 px-2 text-xs font-semibold rounded text-center transition-all cursor-pointer ${
                                  selectedMonth === idx
                                    ? "bg-indigo-600 text-white shadow-md"
                                    : "bg-zinc-950/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                                }`}
                              >
                                {m.substring(0, 3)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 font-semibold mb-1">Modo Reporte</label>
                  <div className="relative">
                    <Layers className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                    <select
                      value={reportMode}
                      onChange={(e) => setReportMode(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500/50 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none text-zinc-200 appearance-none cursor-pointer"
                    >
                      <option value="Triple">Triple (Completo)</option>
                      <option value="Single">Single (Solo Research)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-semibold mb-1">Modo de Investigación (Deep Research)</label>
                <div className="relative">
                  <Sliders className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                  <select
                    value={researchMode}
                    onChange={(e) => setResearchMode(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500/50 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none text-zinc-200 appearance-none cursor-pointer"
                  >
                    <option value="Basica">Básica (Rápida)</option>
                    <option value="Intermedia">Intermedia (Agente)</option>
                    <option value="Avanzada">Avanzada (Agente Pro)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-semibold mb-1">Destinatario del Reporte</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500/50 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none text-zinc-200 placeholder-zinc-600"
                    placeholder="email@dominio.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={executing}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-650 hover:to-purple-750 text-white rounded-lg py-2.5 font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {executing ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Ejecutando Estrategia...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Ejecutar Estrategia
                  </>
                )}
              </button>
            </form>
          </section>

          {/* LOGS TABLE PANEL */}
          <section className="lg:col-span-3 p-5 rounded-xl bg-zinc-900/30 border border-zinc-900 backdrop-blur space-y-4">
            
            {/* Table Filters & Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-zinc-900 pb-4">
              <div>
                <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Historial de Ejecuciones</h2>
                <p className="text-xs text-zinc-450 mt-0.5">Logs de auditoría y descargas asíncronas directas de S3</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500/50 rounded-lg py-1.5 pl-9 pr-3 text-xs focus:outline-none text-zinc-200 placeholder-zinc-600"
                    placeholder="Buscar agencia, mes..."
                  />
                </div>

                <div className="flex bg-zinc-950 rounded-lg p-0.5 border border-zinc-800 w-full sm:w-auto justify-around">
                  <button
                    onClick={() => setStatusFilter("ALL")}
                    className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-all ${
                      statusFilter === "ALL" ? "bg-zinc-800 text-zinc-150" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setStatusFilter("SUCCESS")}
                    className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-all ${
                      statusFilter === "SUCCESS" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Éxito
                  </button>
                  <button
                    onClick={() => setStatusFilter("FAILED")}
                    className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-all ${
                      statusFilter === "FAILED" ? "bg-rose-500/10 text-rose-400 border border-rose-500/10" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Fallidos
                  </button>
                </div>
              </div>
            </div>

            {/* TABLE ELEMENT */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <RotateCw className="w-8 h-8 text-indigo-400 animate-spin" />
                  <span className="text-sm text-zinc-400">Cargando logs del servidor...</span>
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
