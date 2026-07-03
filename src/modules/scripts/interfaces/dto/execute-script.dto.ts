import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ExecuteScriptDto {
  @ApiProperty({
    description: 'Email de destino para recibir el plan estratégico',
    example: 'frzaragoza.arcade@gmail.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Nombre de la agencia para personalizar el plan estratégico',
    example: 'Jetour Guadalajara S.A.',
    required: false,
  })
  @IsString()
  @IsOptional()
  agencyName?: string;

  @ApiProperty({
    description: 'Mes sobre el cual se realiza la planeación',
    example: 'Junio 2026',
    required: false,
  })
  @IsString()
  @IsOptional()
  monthName?: string;

  @ApiProperty({
    description: 'Modalidad de Deep Research a utilizar',
    example: 'Basica',
    required: false,
    enum: ['Basica', 'Intermedia', 'Avanzada'],
  })
  @IsString()
  @IsOptional()
  researchMode?: string;

  @ApiProperty({
    description: 'Modo de reporte a enviar por correo',
    example: 'Single',
    required: false,
    enum: ['Single', 'Triple'],
  })
  @IsString()
  @IsOptional()
  reportMode?: string;

  @ApiProperty({
    description: 'Bandera para determinar si se debe generar el Reporte Ejecutivo PDF (A)',
    example: true,
    required: false,
  })
  @IsOptional()
  generateExecutiveReport?: boolean;

  @ApiProperty({
    description: 'Bandera para determinar si se deben generar las imágenes de campaña en el reporte (A1)',
    example: true,
    required: false,
  })
  @IsOptional()
  generateImages?: boolean;

  @ApiProperty({
    description: 'Bandera para determinar si se deben generar los Reportes Dealers (A2)',
    example: false,
    required: false,
  })
  @IsOptional()
  generateDealers?: boolean;

  @ApiProperty({
    description: 'Cantidad de dealers a procesar para el reporte regional (1 a 100) (A2)',
    example: 5,
    required: false,
  })
  @IsOptional()
  dealersCount?: number;

  @ApiProperty({
    description: 'Bandera para determinar si se deben generar la presentación slide de PowerPoint del plan de trabajo (A3)',
    example: false,
    required: false,
  })
  @IsOptional()
  generateSlides?: boolean;

  @ApiProperty({
    description: 'Bandera para determinar si se debe generar el podcast estratégico de audio del plan de trabajo (A4)',
    example: false,
    required: false,
  })
  @IsOptional()
  generatePodcast?: boolean;

  @ApiProperty({
    description: 'Bandera para determinar si se deben generar las Slides PPTX basadas en Research (B)',
    example: false,
    required: false,
  })
  @IsOptional()
  generateResearchSlides?: boolean;

  @ApiProperty({
    description: 'Bandera para determinar si se debe generar el Podcast Audio basado en Research (C)',
    example: false,
    required: false,
  })
  @IsOptional()
  generateResearchPodcast?: boolean;
}
