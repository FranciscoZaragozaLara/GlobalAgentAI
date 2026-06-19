export enum ScriptStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface ScriptResult {
  success: boolean;
  message: string;
  data?: any;
}
