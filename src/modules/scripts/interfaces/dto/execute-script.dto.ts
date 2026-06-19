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
}
