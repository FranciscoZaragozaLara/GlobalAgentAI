import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseScript } from './base-script';
import { DemoSalesPlanScript } from './demo-sales-plan.script';
import { ScriptResult } from '../domain/script.types';

@Injectable()
export class ScriptRunnerService {
  private readonly scriptsMap = new Map<string, BaseScript>();

  constructor(
    private readonly demoSalesPlanScript: DemoSalesPlanScript,
  ) {
    // Register available scripts
    this.registerScript(this.demoSalesPlanScript);
  }

  private registerScript(script: BaseScript) {
    this.scriptsMap.set(script.name, script);
  }

  getAvailableScripts(): Array<{ name: string; description: string }> {
    return Array.from(this.scriptsMap.values()).map((script) => ({
      name: script.name,
      description: script.description,
    }));
  }

  async runScript(scriptName: string, params: Record<string, any>): Promise<ScriptResult> {
    const script = this.scriptsMap.get(scriptName);
    if (!script) {
      throw new NotFoundException(`Script with name '${scriptName}' not found`);
    }

    return await script.execute(params);
  }
}
