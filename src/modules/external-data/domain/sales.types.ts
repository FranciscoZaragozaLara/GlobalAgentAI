export interface SalesRecord {
  marca: string;
  modelo: string;
  tipo: string;
  imagenModelo: string;
  unidadesVendidas: number;
  unidadesEntregadas: number;
  ingresoUnidadesVendidasSinIVA: number;
  ingresoUnidadesVendidasConIVA: number;
}

export interface SalesQueryFilter {
  anio: number;
  mes: number;
  buscaDistribuidor?: number;
  busquedaModelo?: number;
  busquedaPeriodo?: number;
  fechaFinal?: string;
  fechaInicial?: string;
  idDistribuidor?: (string | number)[];
  idRegion?: (string | number)[];
  modelo?: string;
  page?: number;
  pageSize?: number;
  seminuevo?: boolean;
}
