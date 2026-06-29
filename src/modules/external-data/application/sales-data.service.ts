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
   * Retrieves vehicle sales data grouped by model using authenticated Global DMS API key
   */
  async getVentasResumenXModelo(filter: SalesQueryFilter): Promise<SalesRecord[]> {
    const baseUrl = this.configService.get<string>('GLOBAL_DMS_BASE_URL', 'https://www.globaldms.mx/globalapiOracle');
    const url = `${baseUrl}/Kpis/getVentasVehiculos/ResumenxModelo`;

    try {
      // 1. Retrieve a valid JWT token (it auto-renews dynamically if expired)
      const token = await this.authService.getValidToken();

      // 2. Prepare payload mapping default values for optional parameters
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
      });

      if (response.data && response.data.response === 'OK') {
        const results: SalesRecord[] = response.data.results || [];
        this.logger.log(`Retrieved ${results.length} sales models records successfully.`);
        return results;
      }

      this.logger.warn(`API returned response not OK: ${response.data?.message}`);
      return [];
    } catch (error) {
      if (error.response) {
        this.logger.error(`Sales API Request failed (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      } else {
        this.logger.error(`Error connecting to Sales API: ${error.message}`);
      }
      throw error;
    }
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
}
