import { analyzeExtensionPage } from "@/lib/extension/analyze-extension-page";
import {
  checkRateLimit,
  corsHeaders,
  getClientIp,
  validateExtensionKey,
} from "@/lib/extension/rate-limit";

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  if (!validateExtensionKey(request)) {
    return Response.json(
      { ok: false, error: "Unauthorized extension request." },
      { status: 401, headers },
    );
  }

  const clientIp = getClientIp(request);
  if (!checkRateLimit(clientIp)) {
    return Response.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429, headers },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400, headers },
    );
  }

  const result = await analyzeExtensionPage(body);

  if (!result.ok) {
    return Response.json(result, { status: 400, headers });
  }

  return Response.json(result, { headers });
}
