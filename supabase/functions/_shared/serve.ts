import { checkPipelineKey } from "./auth.ts";

/** Deno.serve protégé par le secret du pipeline. Le handler n'est appelé qu'une fois l'appel autorisé. */
export function servePipeline(handler: (req: Request) => Response | Promise<Response>): void {
  Deno.serve(async (req) => {
    const decision = await checkPipelineKey(req.headers.get("Authorization"), Deno.env.get("PIPELINE_FUNCTIONS_KEY"));
    if (!decision.ok) {
      return new Response(JSON.stringify({ error: decision.error }), {
        status: decision.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return handler(req);
  });
}
