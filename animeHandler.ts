// Import the common handler and necessary functions from main.ts
import { filterRequestHeaders, transformHTML, handleGeneralProxyRequest } from './main.ts';

/**
 * Handles requests routed to the /anime path.
 * Delegates processing to the common handler.
 *
 * @param request - The incoming Request object.
 * @param requestUrl - The parsed URL of the incoming request.
 * @param canonicalUrl - The base URL of the proxy itself.
 * @param animeTarget - The target URL for anime content.
 * @param corsHeaders - Headers for CORS.
 * @returns A Promise resolving to a Response object.
 */
export async function handleAnimeRequest(
    request: Request,
    requestUrl: URL,
    canonicalUrl: string,
    animeTarget: string,
    corsHeaders: Headers
): Promise<Response> {
    console.log(`[INFO] Delegating ANIME request for path: ${requestUrl.pathname}`);

    const targetPathnameRaw = requestUrl.pathname.substring('/anime'.length);
    // Pastikan path kosong setelah /anime menjadi /
    const targetPathname = targetPathnameRaw === '' ? '/' : (targetPathnameRaw.startsWith('/') ? targetPathnameRaw : '/' + targetPathnameRaw);

    const selectedTargetUrl = animeTarget;
    const targetType = 'anime';

    // Call the common general proxy handler
    return handleGeneralProxyRequest(
        request,
        requestUrl,
        canonicalUrl,
        selectedTargetUrl,
        targetType,
        corsHeaders,
        filterRequestHeaders, // Pass the function reference
        transformHTML,        // Pass the function reference
        targetPathname        // Pass the calculated target pathname
    );
}
