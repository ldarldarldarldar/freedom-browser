export interface ViceRunGame {
  start(): void;
  stop(): void;
}

export function createViceRun(canvas: HTMLCanvasElement, opts?: { labels?: Record<string, string> }): ViceRunGame;
