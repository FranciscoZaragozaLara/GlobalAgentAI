export interface AftersalesQueryFilter {
  anio: number;
  mes: number;
  buscaDistribuidor?: number;
  busquedaModelo?: number;
  busquedaPeriodo?: number;
  fechaFinal?: string;
  fechaInicial?: string;
  idDistribuidores?: (string | number)[];
  idRegion?: (string | number)[];
  modelo?: string;
  page?: number;
  pageSize?: number;
}

export interface AftersalesGeneralSummary {
  cantidadOrdenesReparacionFacturadas: string;
  ingresosOnedesReparacionFacturadasSinIVA: string;
  ingresosOnedesReparacionFacturadasConIVA: string;
  ticketPromedioOrdenesReparacionFacturadas: string;
  cantidadOrdenesReparacionEnProceso: string;
  ingresosOrdenesReparacionEnProcesoSinIVA: string;
  ingresosOrdenesReparacionEnProcesoConIVA: string;
  cantidadOrdenesTrabajoFacturadasConImporteCero: string;
  permanenciaTallerTpu: string;
  margenPorServicio: string;
  productividad: string;
  retencionClientesRecurrentes: string;
}

export interface AftersalesMonthlyEvolution {
  mes: string;
  cantidadOrdenesReparacion: string;
  ingresosOrdenesReparacionConIVA: string;
}

export interface AftersalesMonthlyEvolutionResponse {
  [year: string]: AftersalesMonthlyEvolution[];
}

export interface AftersalesChannelBreakdown {
  canalVentas: string;
  cantidadOrdenesTrabajoFacturadas: number;
  ingresosOrdenesTrabajoFacturadasSinIVA: number;
  ingresosOrdenesTrabajoFacturadasConIVA: number;
  cantidadOrdenesTrabajoFacturadasConImporteCero: number;
  ticketPromedioOrdenesTrabajoFacturadas: number;
  utilidadOrdenesTrabajoFacturadas: number;
  margenOrdenesTrabajoFacturadas: number;
}

export interface AftersalesTpuHeatmapRecord {
  dealerId: string;
  dealer: string;
  razonSocial: string;
  cantidadOrdenesTrabajoEnProcesoTotal: string;
  cantidadOrdenesTrabajoEnProcesoRango1: string;
  cantidadOrdenesTrabajoEnProcesoRango2: string;
  cantidadOrdenesTrabajoEnProcesoRango3: string;
  cantidadOrdenesTrabajoEnProcesoRango4: string;
}
