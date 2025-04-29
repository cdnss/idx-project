// File: server.ts

// Import handler functions dan utility functions dari main.ts
import { filterRequestHeaders, transformHTML, handleGeneralProxyRequest } from './main.ts';
import { handleAnimeRequest } from './animeHandler.ts';
import { handleMoviesRequest } from './moviesHandler.ts';
import { handleProxyRequest } from './proxyHandler.ts';

// Konfigurasi target URL dari Environment Variable atau nilai default
const defaultTarget = Deno.env.get("DEFAULT_TARGET_URL") || "https://www.example.com";
const animeTarget = Deno.env.get("ANIME_TARGET_URL") || "https://ww1.anoboy.app"; // Menggunakan URL yang diminta
const moviesTarget = Deno.env.get("MOVIES_TARGET_URL") || "https://tv4.lk21official.cc"; // Menggunakan URL yang diminta

// Header CORS
const corsHeaders = new Headers({
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Origin, X-Requested-With, Content-Type, Accept",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS" // Tambahkan metode yang diizinkan jika diperlukan
});

// Handler utama untuk Deno Deploy (Request Listener)
Deno.serve({ port: 8080 }, async (request: Request) => {
    const requestUrl = new URL(request.url);
    const canonicalUrl = requestUrl.href; // URL proxy Anda sendiri (untuk rewrite link internal)

    console.log(`[INFO] Deno Deploy received request: ${request.method} ${requestUrl.pathname}`); // Log path saja

    // Tangani preflight CORS (OPTIONS)
    if (request.method === "OPTIONS") {
        console.log("[INFO] Handling CORS preflight request.");
        return new Response(null, { headers: corsHeaders });
    }

    // --- Logika Routing Berdasarkan Pathname ---
    if (requestUrl.pathname === '/') {
        console.log("[INFO] Serving default homepage.");
        // Hasilkan HTML statis untuk halaman default
        const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Selamat Datang di Proxy Content</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: #f8f9fa;
            text-align: center;
        }
        .container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="mb-4">Selamat Datang!</h1>
        <p class="lead mb-4">Pilih konten yang ingin Anda akses:</p>
        <div class="d-grid gap-3 col-md-6 mx-auto">
            <a href="/anime" class="btn btn-primary btn-lg">Akses Konten Anime</a>
            <a href="/movies" class="btn btn-secondary btn-lg">Akses Konten Movies</a>
             <p class="mt-4">Atau coba endpoint proxy:</p>
             <p><code>/proxy?url=https://example.com/some/path</code></p>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
        `;
        const responseHeaders = new Headers(corsHeaders);
        responseHeaders.set("Content-Type", "text/html; charset=utf-8");
        return new Response(homepageHtml, { status: 200, headers: responseHeaders });

    } else if (requestUrl.pathname.startsWith('/proxy')) {
        // Delegasikan penanganan ke proxyHandler.ts
        return handleProxyRequest(request, requestUrl, corsHeaders, filterRequestHeaders);

    } else if (requestUrl.pathname.startsWith('/anime')) {
        // Delegasikan penanganan ke animeHandler.ts
        return handleAnimeRequest(request, requestUrl, canonicalUrl, animeTarget, corsHeaders);

    } else if (requestUrl.pathname.startsWith('/movies')) {
        // Delegasikan penanganan ke moviesHandler.ts
        return handleMoviesRequest(request, requestUrl, canonicalUrl, moviesTarget, corsHeaders);

    } else {
        // Penanganan fallback default untuk path lainnya
        console.log(`[INFO] Routing to DEFAULT target (${defaultTarget}) for path: ${requestUrl.pathname}. Delegating to general handler.`);
        const selectedTargetUrl = defaultTarget;
        const targetType = 'default'; // Tipe default untuk transformasi
        const targetPathname = requestUrl.pathname; // Gunakan seluruh pathname asli

         // Delegasikan penanganan ke fungsi handler umum di main.ts
        return handleGeneralProxyRequest(
            request,
            requestUrl,
            canonicalUrl,
            selectedTargetUrl,
            targetType,
            corsHeaders,
            filterRequestHeaders, // Pass function reference
            transformHTML,        // Pass function reference
            targetPathname        // Pass the original pathname for default
        );
    }
    // Jika sampai sini, artinya respons sudah dikembalikan oleh salah satu handler di atas
});

console.log(`[INFO] Deno server started with modular routing.`);
console.log(`[INFO] Root path serves a static homepage.`);
console.log(`[INFO] Anime target: ${animeTarget} handled by animeHandler.ts`);
console.log(`[INFO] Movies target: ${moviesTarget} handled by moviesHandler.ts`);
console.log(`[INFO] Endpoint /proxy?url=... handled by proxyHandler.ts`);
console.log(`[INFO] Other paths fallback to default target: ${defaultTarget} handled by common logic in main.ts`);
