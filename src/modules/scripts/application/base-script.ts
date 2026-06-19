import { ScriptResult } from '../domain/script.types';

export abstract class BaseScript {
  abstract readonly name: string;
  abstract readonly description: string;

  abstract execute(params: Record<string, any>): Promise<ScriptResult>;
}
