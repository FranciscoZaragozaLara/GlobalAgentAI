import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SalesDataService } from '../application/sales-data.service';
import { SalesAnalyticsService } from '../application/sales-analytics.service';
import { SalesQueryDto } from './dto/sales-query.dto';
import { SalesRecord } from '../domain/sales.types';

@ApiTags('External Sales Data')
@Controller('api/v1/sales-data')
export class ExternalDataController {
  constructor(
    private readonly salesDataService: SalesDataService,
    private readonly salesAnalyticsService: SalesAnalyticsService,
  ) {}

  @Post('resumen-modelo')
  @ApiOperation({ summary: 'Obtener resumen de unidades vendidas por modelo desde las APIs de .NET' })
  @ApiResponse({ status: 200, description: 'Listado obtenido con éxito de forma autenticada.' })
  async getResumenModelo(@Body() query: SalesQueryDto): Promise<SalesRecord[]> {
    return await this.salesDataService.getVentasResumenXModelo(query);
  }

  @Get('comparativa')
  @ApiOperation({ summary: 'Calcular tendencia histórica de ventas y objetivos proyectados' })
  @ApiResponse({ status: 200, description: 'Resumen comparativo con cálculos de tendencia y propuestas.' })
  async getComparativa(
    @Query('anio') anio: number,
    @Query('mes') mes: number,
  ) {
    return await this.salesAnalyticsService.generateStrategyMetrics(Number(anio), Number(mes));
  }
}

