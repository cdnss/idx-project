// Import dependencies needed for handling /proxy requests
// Only need filterRequestHeaders for this endpoint
import { filterRequestHeaders } from './main.ts';

// Definisikan tipe untuk fungsi yang diimpor
type FilterHeadersFn = typeof filterRequestHeaders;

/**
 * Handles requests routed to the /proxy path.
 * Fetches content from a URL specified in the query parameter.
 *
 * @param request - The incoming Request object.
 * @param requestUrl - The parsed URL of the incoming request.
 * @param corsHeaders - Headers for CORS.
 * @param filterHeaders - Function to filter request headers (imported from main.ts).
 * @returns A Promise resolving to a Response object.
 */
export async function handleProxyRequest(
    request: Request,
    requestUrl: URL,
    corsHeaders: Headers,
    filterHeaders: FilterHeadersFn
): Promise<Response> {
    console.log(`[INFO] Handling /proxy request.`);

    const targetUrlParam = requestUrl.searchParams.get('url');
    const responseTypeParam = requestUrl.searchParams.get('type'); // Ambil parameter 'type'
    const returnAsHtml = responseTypeParam === 'html'; // Tentukan apakah diinginkan format HTML

    if (!targetUrlParam) {
        console.log("[WARN] /proxy request missing 'url' parameter.");
        const errorResponse = { error: "Missing 'url' query parameter." };
        const responseHeaders = new Headers(corsHeaders);
        responseHeaders.set("Content-Type", "application/json");
        return new Response(JSON.stringify(errorResponse), { status: 400, headers: responseHeaders });
    }

    let fetchTargetUrl: URL;
    try {
        fetchTargetUrl = new URL(targetUrlParam);
        console.log(`[INFO] Proxying URL from parameter: ${fetchTargetUrl.toString()}`);
    } catch (e) {
        console.log(`[WARN] Invalid URL parameter: ${targetUrlParam}`, e);
        const errorResponse = { error: "Invalid URL provided." };
        const responseHeaders = new Headers(corsHeaders);
        responseHeaders.set("Content-Type", "application/json");
        return new Response(JSON.stringify(errorResponse), { status: 400, headers: responseHeaders });
    }

    try {
        // Filter header dari request asli sebelum dikirim ke target
        const filteredHeaders = filterHeaders(request.headers);

        // Lakukan fetch ke URL target
        const proxyResponse = await fetch(fetchTargetUrl.toString(), {
            method: request.method, // Gunakan metode dari request asli
            headers: filteredHeaders, // Gunakan header yang sudah difilter
            body: request.body, // Teruskan body dari request asli
            redirect: 'follow' // Endpoint /proxy ini mengikuti redirect secara otomatis
        });

        console.log(`[INFO] Received response from proxied URL via /proxy: Status ${proxyResponse.status}`);

        // Baca body respons
        // Endpoint /proxy default-nya JSON, jadi baca teks untuk dimasukkan ke JSON
         const content = await proxyResponse.text();


        if (returnAsHtml) {
            console.log(`[INFO] Successfully fetched content from ${targetUrlParam}, returning raw content as HTML.`);
             // Jika type=html, kembalikan konten mentah dengan Content-Type yang sesuai
            const responseHeaders = new Headers(corsHeaders);
             // Pertahankan Content-Type asli jika itu text/html, jika tidak set ke text/html
             const contentType = proxyResponse.headers.get("content-type") || "text/html";
             responseHeaders.set("Content-Type", contentType.includes("text/html") ? contentType : "text/html; charset=utf-8");
             // Hapus content-encoding/length karena kita sudah membaca kontennya
             responseHeaders.delete("content-encoding");
             responseHeaders.delete("content-length");

            // Mengembalikan konten mentah
            return new Response(content, {
                status: proxyResponse.status,
                headers: responseHeaders,
            });
        } else {
             // Bentuk respons JSON (default atau jika type=json tidak dispesifikasikan)
            const jsonResponse = { contents: content };

             // Siapkan header untuk respons JSON
            const responseHeaders = new Headers(corsHeaders);
            responseHeaders.set("Content-Type", "application/json");

            console.log(`[INFO] Successfully fetched content from ${targetUrlParam}, returning JSON.`);

             // Kembalikan respons JSON
            return new Response(JSON.stringify(jsonResponse), {
                 status: 200, // Status 200 OK jika fetch berhasil
                 headers: responseHeaders,
            });
        }


    } catch (error) {
        console.error(`[ERROR] Failed to fetch URL ${targetUrlParam} via /proxy:`, error);
        const errorResponse = { error: `Failed to fetch URL: ${error.message || error}` };
        const responseHeaders = new Headers(corsHeaders);
        responseHeaders.set("Content-Type", "application/json");
        return new Response(JSON.stringify(errorResponse), { status: 500, headers: responseHeaders });
    }
}
