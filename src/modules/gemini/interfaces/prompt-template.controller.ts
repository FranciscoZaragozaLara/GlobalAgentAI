import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PromptTemplateService } from '../application/prompt-template.service';

class UpdatePromptDto {
  name?: string;
  description?: string;
  content: string;
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

  @Put(':key')
  @ApiOperation({ summary: 'Actualizar una plantilla de prompt' })
  @ApiResponse({ status: 200, description: 'Plantilla de prompt actualizada con éxito.' })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada.' })
  async updatePrompt(
    @Param('key') key: string,
    @Body() body: UpdatePromptDto,
  ) {
    return await this.promptService.update(key, body);
  }
}
