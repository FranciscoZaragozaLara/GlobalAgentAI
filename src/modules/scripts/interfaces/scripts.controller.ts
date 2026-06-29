import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ScriptRunnerService } from '../application/script-runner.service';
import { ExecuteScriptDto } from './dto/execute-script.dto';
import { ScriptResult } from '../domain/script.types';

@ApiTags('Scripts Manager')
@Controller('api/v1/scripts')
export class ScriptsController {
  constructor(private readonly scriptRunnerService: ScriptRunnerService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener lista de scripts disponibles para ejecución' })
  @ApiResponse({ status: 200, description: 'Lista de scripts devuelta con éxito.' })
  getScripts() {
    return this.scriptRunnerService.getAvailableScripts();
  }

  @Get('logs')
  @ApiOperation({ summary: 'Obtener historial de logs de ejecución y URLs firmadas de artefactos' })
  @ApiResponse({ status: 200, description: 'Historial de logs devuelto con éxito' })
  async getLogs() {
    return await this.scriptRunnerService.getExecutionLogs();
  }

  @Get('logs/:parentLogId/dealers')
  @ApiOperation({ summary: 'Obtener logs de ejecuciones atómicas de dealers asociados a un log máster' })
  @ApiResponse({ status: 200, description: 'Logs de dealers devueltos con éxito' })
  async getDealerLogs(@Param('parentLogId') parentLogId: string) {
    return await this.scriptRunnerService.getDealerExecutionLogs(parentLogId);
  }

  @Post(':scriptName/execute')
  @ApiOperation({ summary: 'Ejecutar un script registrado de forma síncrona' })
  @ApiResponse({ status: 200, description: 'Script ejecutado con éxito' })
  @ApiResponse({ status: 404, description: 'Script no encontrado' })
  async executeScript(
    @Param('scriptName') scriptName: string,
    @Body() body: ExecuteScriptDto,
  ): Promise<ScriptResult> {
    return await this.scriptRunnerService.runScript(scriptName, body);
  }
}
