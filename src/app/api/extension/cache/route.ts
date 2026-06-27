import {
  findCachedScanByNormalizedUrl,
  normalizeScanUrl,
  toExtensionAnalyzeResponse,
} from "@/lib/scan-cache";
import {
  corsHeaders,
  validateExtensionKey,
} from "@/lib/extension/rate-limit";

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  if (!validateExtensionKey(request)) {
    return Response.json(
      { ok: false, error: "Unauthorized extension request." },
      { status: 401, headers },
    );
  }

  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return Response.json(
      { ok: false, error: "Missing url parameter." },
      { status: 400, headers },
    );
  }

  const normalizedUrl = normalizeScanUrl(url);
  if (!normalizedUrl) {
    return Response.json(
      { ok: false, error: "Invalid URL." },
      { status: 400, headers },
    );
  }

  const cached = await findCachedScanByNormalizedUrl(normalizedUrl);
  if (!cached) {
    return Response.json(
      { ok: false, error: "No cached scan for this URL." },
      { status: 404, headers },
    );
  }

  return Response.json(toExtensionAnalyzeResponse(cached), { headers });
}
