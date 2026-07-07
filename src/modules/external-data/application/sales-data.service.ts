import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AuthService } from '../../auth/application/auth.service';
import { SalesQueryFilter, SalesRecord } from '../domain/sales.types';

@Injectable()
export class SalesDataService {
  private readonly logger = new Logger(SalesDataService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Helper method to retry failed HTTP operations with exponential backoff
   */
  private async callWithRetry<T>(operationName: string, fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        if (i === retries - 1) {
          this.logger.error(`Operation ${operationName} failed after ${retries} attempts. Last error: ${err.message}`);
          throw err;
        }
        this.logger.warn(`[Attempt ${i + 1}/${retries}] Operation ${operationName} failed: ${err.message}. Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      }
    }
    throw new Error(`Retries exhausted for ${operationName}`);
  }

  /**
   * Retrieves vehicle sales data grouped by model using authenticated Global DMS API key
   */
  async getVentasResumenXModelo(filter: SalesQueryFilter): Promise<SalesRecord[]> {
    const baseUrl = this.configService.get<string>('GLOBAL_DMS_BASE_URL', 'https://www.globaldms.mx/globalapiOracle');
    const url = `${baseUrl}/Kpis/getVentasVehiculos/ResumenxModelo`;

    return this.callWithRetry('getVentasResumenXModelo', async () => {
      const token = await this.authService.getValidToken();

      const payload = {
        anio: filter.anio,
        mes: filter.mes,
        buscaDistribuidor: filter.buscaDistribuidor ?? 0,
        busquedaModelo: filter.busquedaModelo ?? 0,
        busquedaPeriodo: filter.busquedaPeriodo ?? 3,
        fechaFinal: filter.fechaFinal ?? '',
        fechaInicial: filter.fechaInicial ?? '',
        idDistribuidor: filter.idDistribuidor ?? [],
        idRegion: filter.idRegion ?? [],
        modelo: filter.modelo ?? '',
        page: filter.page ?? 0,
        pageSize: filter.pageSize ?? 0,
        seminuevo: filter.seminuevo ?? false,
      };

      this.logger.log(`Calling Sales Summary API for Period: ${filter.mes}/${filter.anio}...`);

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 10000, // 10 seconds timeout
      });

      if (response.data && response.data.response === 'OK') {
        const results: SalesRecord[] = response.data.results || [];
        this.logger.log(`Retrieved ${results.length} sales models records successfully.`);
        return results;
      }
      throw new Error(`API returned response not OK: ${response.data?.message}`);
    });
  }

  /**
   * Retrieves all distributors / dealers catalog using authenticated Global DMS API
   */
  async getDistribuidores(): Promise<any[]> {
    const baseUrl = this.configService.get<string>('GLOBAL_DMS_BASE_URL', 'https://www.globaldms.mx/globalapiOracle');
    const url = `${baseUrl}/Kpis/getCatalogoDistribuidores`;

    try {
      const token = await this.authService.getValidToken();
      const payload = {
        page: 0,
        pageSize: 0,
      };

      this.logger.log('Calling Catalog of Distributors API...');

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.data && response.data.response === 'OK') {
        const results = response.data.results || [];
        this.logger.log(`Retrieved ${results.length} distributors records successfully.`);
        return results;
      }

      this.logger.warn(`Distributors API returned response not OK: ${response.data?.message}`);
      return [];
    } catch (error) {
      if (error.response) {
        this.logger.error(`Distributors API Request failed (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      } else {
        this.logger.error(`Error connecting to Distributors API: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Retrieves vehicle inventory summary totals (Nuevos, Seminuevos, Totales)
   */
  async getExistenciaNuevosSeminuevosTotales(): Promise<any> {
    const baseUrl = this.configService.get<string>('GLOBAL_DMS_BASE_URL', 'https://www.globaldms.mx/globalapiOracle');
    const url = `${baseUrl}/Kpis/getExistenciaVehiculos/NuevosSeminuevosTotales`;
    const payload = { buscaDistribuidor: 0, idDistribuidor: [] };

    return this.callWithRetry('getExistenciaNuevosSeminuevosTotales', async () => {
      const token = await this.authService.getValidToken();
      this.logger.log('Calling getExistenciaVehiculos/NuevosSeminuevosTotales API...');
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 10000,
      });

      if (response.data && response.data.response === 'OK') {
        return response.data.results;
      }
      throw new Error(response.data?.message || 'Response not OK');
    });
  }

  /**
   * Retrieves vehicle inventory Brand and Model summary
   */
  async getExistenciaResumenMarcaModelo(): Promise<any> {
    const baseUrl = this.configService.get<string>('GLOBAL_DMS_BASE_URL', 'https://www.globaldms.mx/globalapiOracle');
    const url = `${baseUrl}/Kpis/getExistenciaVehiculos/ResumenMarcaModelo`;
    const payload = { buscaDistribuidor: 0, idDistribuidor: [] };

    return this.callWithRetry('getExistenciaResumenMarcaModelo', async () => {
      const token = await this.authService.getValidToken();
      this.logger.log('Calling getExistenciaVehiculos/ResumenMarcaModelo API...');
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 10000,
      });

      if (response.data && response.data.response === 'OK') {
        return response.data.results;
      }
      throw new Error(response.data?.message || 'Response not OK');
    });
  }
}
