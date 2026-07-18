import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PromptTemplateService } from '../application/prompt-template.service';
import { AdminGuard } from '../../auth/infrastructure/admin.guard';

class UpdatePromptDto {
  name?: string;
  description?: string;
  content: string;
  changeReason?: string;
}

@ApiTags('Prompts Manager')
@Controller('api/v1/prompts')
export class PromptTemplateController {
  constructor(private readonly promptService: PromptTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener lista de todas las plantillas de prompts' })
  @ApiResponse({ status: 200, description: 'Lista de prompts devuelta con éxito.' })
  async getPrompts() {
    return await this.promptService.findAll();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Obtener el contenido de una plantilla de prompt específica' })
  @ApiResponse({ status: 200, description: 'Plantilla de prompt devuelta con éxito.' })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada.' })
  async getPromptByKey(@Param('key') key: string) {
    return await this.promptService.findByKey(key);
  }

  @Get(':key/versions')
  @ApiOperation({ summary: 'Obtener el historial de versiones de una plantilla' })
  @ApiResponse({ status: 200, description: 'Historial devuelto con éxito.' })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada.' })
  async getVersions(@Param('key') key: string) {
    return await this.promptService.findVersions(key);
  }

  @Put(':key')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Actualizar una plantilla de prompt' })
  @ApiResponse({ status: 200, description: 'Plantilla de prompt actualizada con éxito.' })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada.' })
  async updatePrompt(
    @Param('key') key: string,
    @Body() body: UpdatePromptDto,
  ) {
    return await this.promptService.update(key, body);
  }

  @Post(':key/rollback/:versionId')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Restaurar una plantilla a una versión específica' })
  @ApiResponse({ status: 200, description: 'Rollback realizado con éxito.' })
  @ApiResponse({ status: 404, description: 'Plantilla o versión no encontrada.' })
  async rollbackPrompt(
    @Param('key') key: string,
    @Param('versionId') versionId: string,
  ) {
    return await this.promptService.rollback(key, versionId);
  }
}
