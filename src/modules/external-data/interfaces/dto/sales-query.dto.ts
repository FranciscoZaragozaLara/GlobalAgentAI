import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SalesQueryDto {
  @ApiProperty({
    description: 'Año a consultar para el análisis de ventas',
    example: 2026,
    required: true,
  })
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio: number;

  @ApiProperty({
    description: 'Mes a consultar para el análisis de ventas (1-12)',
    example: 6,
    required: true,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  @ApiProperty({ description: 'Parámetro buscaDistribuidor', example: 0, required: false })
  @IsInt()
  @IsOptional()
  buscaDistribuidor?: number = 0;

  @ApiProperty({ description: 'Parámetro busquedaModelo', example: 0, required: false })
  @IsInt()
  @IsOptional()
  busquedaModelo?: number = 0;

  @ApiProperty({ description: 'Parámetro busquedaPeriodo (3 para mensual)', example: 3, required: false })
  @IsInt()
  @IsOptional()
  busquedaPeriodo?: number = 3;

  @ApiProperty({ description: 'Filtro fechaFinal', example: '', required: false })
  @IsString()
  @IsOptional()
  fechaFinal?: string = '';

  @ApiProperty({ description: 'Filtro fechaInicial', example: '', required: false })
  @IsString()
  @IsOptional()
  fechaInicial?: string = '';

  @ApiProperty({ description: 'Arreglo de IDs de Distribuidores/Agencias', example: [], required: false })
  @IsArray()
  @IsOptional()
  idDistribuidor?: number[] = [];

  @ApiProperty({ description: 'Arreglo de IDs de Regiones', example: [], required: false })
  @IsArray()
  @IsOptional()
  idRegion?: number[] = [];

  @ApiProperty({ description: 'Filtro específico por Modelo de coche', example: '', required: false })
  @IsString()
  @IsOptional()
  modelo?: string = '';

  @ApiProperty({ description: 'Número de página', example: 0, required: false })
  @IsInt()
  @IsOptional()
  page?: number = 0;

  @ApiProperty({ description: 'Tamaño de página', example: 0, required: false })
  @IsInt()
  @IsOptional()
  pageSize?: number = 0;

  @ApiProperty({ description: 'Consultar mercado seminuevo', example: false, required: false })
  @IsBoolean()
  @IsOptional()
  seminuevo?: boolean = false;
}
