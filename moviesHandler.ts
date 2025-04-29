// Import the common handler and necessary functions from main.ts
import { filterRequestHeaders, transformHTML, handleGeneralProxyRequest } from './main.ts';

/**
 * Handles requests routed to the /movies path.
 * Delegates processing to the common handler.
 *
 * @param request - The incoming Request object.
 * @param requestUrl - The parsed URL of the incoming request.
 * @param canonicalUrl - The base URL of the proxy itself.
 * @param moviesTarget - The target URL for movies content.
 * @param corsHeaders - Headers for CORS.
 * @returns A Promise resolving to a Response object.
 */
export async function handleMoviesRequest(
    request: Request,
    requestUrl: URL,
    canonicalUrl: string,
    moviesTarget: string,
    corsHeaders: Headers
): Promise<Response> {
    console.log(`[INFO] Delegating MOVIES request for path: ${requestUrl.pathname}`);

    const targetPathnameRaw = requestUrl.pathname.substring('/movies'.length);
    // Pastikan path kosong setelah /movies menjadi /
    const targetPathname = targetPathnameRaw === '' ? '/' : (targetPathnameRaw.startsWith('/') ? targetPathnameRaw : '/' + targetPathnameRaw);


    const selectedTargetUrl = moviesTarget;
    const targetType = 'movies';

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
