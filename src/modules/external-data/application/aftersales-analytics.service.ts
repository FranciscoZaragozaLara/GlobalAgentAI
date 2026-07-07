import { Injectable, Logger } from '@nestjs/common';
import { AftersalesDataService } from './aftersales-data.service';
import {
  AftersalesGeneralSummary,
  AftersalesMonthlyEvolutionResponse,
  AftersalesChannelBreakdown,
  AftersalesTpuHeatmapRecord,
} from '../domain/aftersales.types';

export interface AftersalesAnalyticsResult {
  targetMonth: AftersalesGeneralSummary | null;
  priorMonth: AftersalesGeneralSummary | null;
  ytd: AftersalesGeneralSummary | null;
  monthlyEvolution: AftersalesMonthlyEvolutionResponse | null;
  channels: AftersalesChannelBreakdown[];
  tpuEnProceso: AftersalesTpuHeatmapRecord[];
  tpuFacturadas: AftersalesTpuHeatmapRecord[];
}

@Injectable()
export class AftersalesAnalyticsService {
  private readonly logger = new Logger(AftersalesAnalyticsService.name);

  constructor(private readonly aftersalesDataService: AftersalesDataService) {}

  async generateAftersalesStrategyMetrics(
    year: number,
    month: number,
    idDistribuidor?: string,
  ): Promise<AftersalesAnalyticsResult> {
    this.logger.log(
      `Generating Aftersales strategy metrics comparison for Month ${month}/${year}${
        idDistribuidor ? ' (Dealer: ' + idDistribuidor + ')' : ''
      }...`,
    );

    // Build filter options if a specific dealer is selected
    const filterOptions: any = {};
    if (idDistribuidor && idDistribuidor.trim() !== '') {
      filterOptions.buscaDistribuidor = 1;
      filterOptions.idDistribuidores = [idDistribuidor];
    }

    // --- STEP 1: CALCULATE TARGET REPORT PERIOD (IMMEDIATE PREVIOUS MONTH) ---
    // The "month of interest" for report data is the month prior to the requested month.
    let reportMonth = month - 1;
    let reportYear = year;
    if (reportMonth <= 0) {
      reportMonth = 12;
      reportYear = year - 1;
    }

    // --- STEP 2: CALCULATE PRIOR MONTH (MONTH BEFORE REPORT PERIOD) ---
    let priorReportMonth = reportMonth - 1;
    let priorReportYear = reportYear;
    if (priorReportMonth <= 0) {
      priorReportMonth = 12;
      priorReportYear = reportYear - 1;
    }

    this.logger.log(`Target Report Period: ${reportMonth}/${reportYear}. Prior Period: ${priorReportMonth}/${priorReportYear}`);

    // --- STEP 3: CONSTRUCT YTD PARAMETERS (Always busquedaPeriodo: 2) ---
    const ytdFilter = {
      anio: reportYear,
      mes: 0,
      busquedaPeriodo: 2, // Year-based
      fechaInicial: '',
      fechaFinal: '',
    };
    this.logger.log(`YTD Period: Year ${reportYear} (busquedaPeriodo: 2)`);

    // --- STEP 4: CONSTRUCT TPU FACTURADAS PARAMETERS (YTD TO CLOSE OF PRIOR MONTH) ---
    const tpuFacturadasFilter = {
      anio: reportYear,
      mes: 0,
      busquedaPeriodo: 2, // Year-based
      fechaInicial: '',
      fechaFinal: '',
    };

    // Fire API requests in parallel for maximum performance
    const [
      targetMonthRes,
      priorMonthRes,
      ytdRes,
      monthlyEvolution,
      channels,
      tpuEnProceso,
      tpuFacturadas,
    ] = await Promise.all([
      // 1. Target Month Summary (busquedaPeriodo = 3: Mes)
      this.aftersalesDataService.getResumenGeneral({
        anio: reportYear,
        mes: reportMonth,
        busquedaPeriodo: 3,
        ...filterOptions,
      }),
      // 2. Prior Month Summary (busquedaPeriodo = 3: Mes)
      this.aftersalesDataService.getResumenGeneral({
        anio: priorReportYear,
        mes: priorReportMonth,
        busquedaPeriodo: 3,
        ...filterOptions,
      }),
      // 3. YTD Summary (Custom mapped based on report month)
      this.aftersalesDataService.getResumenGeneral({
        ...ytdFilter,
        ...filterOptions,
      }),
      // 4. Monthly Evolution trend (up to reportMonth)
      this.aftersalesDataService.getEvolucionMensual({
        anio: reportYear,
        mes: reportMonth,
        busquedaPeriodo: 3,
        ...filterOptions,
      }),
      // 5. Sales channels breakdown (for reportMonth)
      this.aftersalesDataService.getPorCanalVentas({
        anio: reportYear,
        mes: reportMonth,
        busquedaPeriodo: 3,
        ...filterOptions,
      }),
      // 6. TPU en Proceso / Abiertas (busquedaPeriodo = 0, anio = 0, mes = 0)
      this.aftersalesDataService.getTPUPorDistribuidorEnProceso({
        anio: 0,
        mes: 0,
        busquedaPeriodo: 0,
        fechaInicial: '',
        fechaFinal: '',
        ...filterOptions,
      }),
      // 7. TPU Facturadas / YTD (busquedaPeriodo = 2, anio = reportYear, mes = 0)
      this.aftersalesDataService.getTPUPorDistribuidorFacturadas({
        ...tpuFacturadasFilter,
        ...filterOptions,
      }),
    ]);

    return {
      targetMonth: targetMonthRes.length > 0 ? targetMonthRes[0] : null,
      priorMonth: priorMonthRes.length > 0 ? priorMonthRes[0] : null,
      ytd: ytdRes.length > 0 ? ytdRes[0] : null,
      monthlyEvolution,
      channels,
      tpuEnProceso,
      tpuFacturadas,
    };
  }
}
