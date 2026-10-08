// WEBHOOK HARNESS STUB — std/http/server.ts `serve` yerine: dinlemez, handler'ı yakalar.
export let capturedHandler: ((req: Request) => Promise<Response>) | null = null;
export function serve(handler: (req: Request) => Promise<Response>): void { capturedHandler = handler; }
