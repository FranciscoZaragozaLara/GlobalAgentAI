import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AuthService } from '../../auth/application/auth.service';
import {
  AftersalesQueryFilter,
  AftersalesGeneralSummary,
  AftersalesMonthlyEvolutionResponse,
  AftersalesChannelBreakdown,
  AftersalesTpuHeatmapRecord,
} from '../domain/aftersales.types';

@Injectable()
export class AftersalesDataService {
  private readonly logger = new Logger(AftersalesDataService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  private async postToOracle<T>(endpoint: string, payload: any): Promise<T[]> {
    const baseUrl = this.configService.get<string>('GLOBAL_DMS_BASE_URL', 'https://www.globaldms.mx/globalapiOracle');
    const url = `${baseUrl}/Kpis${endpoint}`;

    try {
      const token = await this.authService.getValidToken();

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 25000,
      });

      if (response.data && response.data.response === 'OK') {
        const results = response.data.results;
        return Array.isArray(results) ? results : [results] as any;
      }

      this.logger.warn(`API [${endpoint}] returned error status: ${response.data?.message}`);
      return [];
    } catch (error) {
      this.logger.error(`HTTP error calling API [${endpoint}]: ${error.message}`);
      return [];
    }
  }

  private async postToOracleObject<T>(endpoint: string, payload: any): Promise<T | null> {
    const baseUrl = this.configService.get<string>('GLOBAL_DMS_BASE_URL', 'https://www.globaldms.mx/globalapiOracle');
    const url = `${baseUrl}/Kpis${endpoint}`;

    try {
      const token = await this.authService.getValidToken();

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 25000,
      });

      if (response.data && response.data.response === 'OK') {
        return response.data.results as T;
      }

      this.logger.warn(`API [${endpoint}] returned error status: ${response.data?.message}`);
      return null;
    } catch (error) {
      this.logger.error(`HTTP error calling API [${endpoint}]: ${error.message}`);
      return null;
    }
  }

  private buildPayload(filter: AftersalesQueryFilter): any {
    return {
      anio: filter.anio,
      mes: filter.mes,
      buscaDistribuidor: filter.buscaDistribuidor ?? 0,
      busquedaModelo: filter.busquedaModelo ?? 0,
      busquedaPeriodo: filter.busquedaPeriodo ?? 3,
      fechaFinal: filter.fechaFinal ?? '',
      fechaInicial: filter.fechaInicial ?? '',
      idDistribuidores: filter.idDistribuidores ?? [],
      idRegion: filter.idRegion ?? [],
      modelo: filter.modelo ?? '',
      page: filter.page ?? 0,
      pageSize: filter.pageSize ?? 0,
    };
  }

  /**
   * 1. Resumen General del Taller
   */
  async getResumenGeneral(filter: AftersalesQueryFilter): Promise<AftersalesGeneralSummary[]> {
    this.logger.log(`Fetching general workshop summary for Period: ${filter.mes}/${filter.anio}...`);
    const payload = this.buildPayload(filter);
    return this.postToOracle<AftersalesGeneralSummary>('/getOrdenesServicio/ResumenGeneral', payload);
  }

  /**
   * 2. Evolución Mensual (YoY Tendency)
   */
  async getEvolucionMensual(filter: AftersalesQueryFilter): Promise<AftersalesMonthlyEvolutionResponse | null> {
    this.logger.log(`Fetching monthly evolution trend for Period: ${filter.mes}/${filter.anio}...`);
    const payload = this.buildPayload(filter);
    return this.postToOracleObject<AftersalesMonthlyEvolutionResponse>('/getOrdenesServicio/EvolucionMensual', payload);
  }

  /**
   * 3. Desglose por Canal de Ventas
   */
  async getPorCanalVentas(filter: AftersalesQueryFilter): Promise<AftersalesChannelBreakdown[]> {
    this.logger.log(`Fetching sales channel breakdown for Period: ${filter.mes}/${filter.anio}...`);
    const payload = this.buildPayload(filter);
    return this.postToOracle<AftersalesChannelBreakdown>('/getOrdenesServicio/PorCanalVentas', payload);
  }

  /**
   * 4. Mapa de Calor Operativo (TPU)
   */
  async getTPUPorDistribuidorEnProceso(filter: AftersalesQueryFilter): Promise<AftersalesTpuHeatmapRecord[]> {
    this.logger.log(`Fetching TPU heatmap records for Period: ${filter.mes}/${filter.anio}...`);
    const payload = this.buildPayload(filter);
    return this.postToOracle<AftersalesTpuHeatmapRecord>('/getOrdenesServicio/TPUPorDistribuidorEnProceso', payload);
  }

  /**
   * 5. TPU Facturadas YTD
   */
  async getTPUPorDistribuidorFacturadas(filter: AftersalesQueryFilter): Promise<AftersalesTpuHeatmapRecord[]> {
    this.logger.log(`Fetching TPU Billed records for Period: ${filter.mes}/${filter.anio}...`);
    const payload = this.buildPayload(filter);
    return this.postToOracle<AftersalesTpuHeatmapRecord>('/getOrdenesServicio/TPUPorDistribuidorFacturadas', payload);
  }
}
