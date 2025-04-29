// Import dependency
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

// --- Utility Function: Header Filtering ---

/**
 * Fungsi untuk menyaring header request agar tidak mengirimkan header sensitif.
 */
export function filterRequestHeaders(headers: Headers): Headers {
  const newHeaders = new Headers();
  const forbidden = [
    "host",
    "connection",
    "x-forwarded-for",
    "cf-connecting-ip",
    "cf-ipcountry",
    "x-real-ip",
    "cookie",
    "authorization",
    "referer",
 ];

  for (const [key, value] of headers.entries()) {
    if (!forbidden.includes(key.toLowerCase())) {
      newHeaders.append(key, value);
    } else {
       // console.log(`[INFO] Filtering out header in main.ts: ${key}`);
    }
  }
  return newHeaders;
}

// --- HTML Transformation Logic (kept the same) ---

const commonUnwantedSelectors = [
    'script[src*="ad"], script[src*="analytics"], script[src*="googletagmanager"], script[src*="doubleclick"]',
    'script:contains("adsbygoogle")',
    'div[data-ad-client], div[data-ad-slot]'
];

const animeUnwantedSelectors = [
    ".ads", ".advertisement", ".banner", ".iklan",
    "#ad_box", "#ad_bawah", "#judi", "#judi2",
    ...commonUnwantedSelectors
];

const moviesUnwantedSelectors = [
    ".ads", ".advertisement", ".banner", ".iklan",
    "#ad_box", "#ad_bawah",
    ...commonUnwantedSelectors
];

const defaultUnwantedSelectors = [
    ...commonUnwantedSelectors
];

function removeUnwantedElements($: cheerio.CheerioAPI, targetType: 'anime' | 'movies' | 'default'): void {
    let unwantedSelectors: string[] = [];
    switch (targetType) {
        case 'anime':
            unwantedSelectors = animeUnwantedSelectors;
            break;
        case 'movies':
            unwantedSelectors = moviesUnwantedSelectors;
            break;
        case 'default':
        default:
            unwantedSelectors = defaultUnwantedSelectors;
            break;
    }

    unwantedSelectors.forEach((selector) => {
        try {
            $(selector).remove();
        } catch (e) {
            console.error(`[ERROR] Error removing elements with selector "${selector}" for ${targetType}:`, e);
        }
    });
    console.log(`[INFO] Finished removing unwanted elements for ${targetType}.`);
}

function addLazyLoading($: cheerio.CheerioAPI): void {
    $("img, iframe").each((_, el) => {
        if (!$(el).attr("loading")) {
            $(el).attr("loading", "lazy");
        }
    });
    console.log("[INFO] Added lazy loading to images and iframes.");
}

function rewriteUrls($: cheerio.CheerioAPI, canonicalUrl: string, selectedTargetUrl: string, targetType: 'anime' | 'movies' | 'default'): void {
    const attributesToRewrite = ['href', 'src', 'data-src', 'data-href', 'data-url'];
    const canonicalOrigin = new URL(canonicalUrl).origin;
    const targetOrigin = new URL(selectedTargetUrl).origin;

    $('*').each((_, el) => {
        attributesToRewrite.forEach(attr => {
            const originalValue = $(el).attr(attr);
            if (originalValue) {
                try {
                    const url = new URL(originalValue, selectedTargetUrl);

                    if (targetOrigin && (url.origin === targetOrigin || (url.host.endsWith('.' + new URL(selectedTargetUrl).hostname) && url.origin.startsWith('http')) || (originalValue.startsWith('/') && !originalValue.startsWith('//'))) && !originalValue.startsWith('#') && !originalValue.startsWith('mailto:')) {
                         let newPath = url.pathname;

                         if (!newPath.startsWith('/')) {
                             newPath = '/' + newPath;
                         }

                         let prefix = '';
                         if (targetType === 'anime') {
                             prefix = '/anime';
                         } else if (targetType === 'movies') {
                             prefix = '/movies';
                         }

                          if (prefix !== '' && !newPath.startsWith(prefix + '/')) {
                             newPath = prefix + newPath;
                          }

                         const proxiedUrl = new URL(newPath + url.search + url.hash, canonicalOrigin);
                         proxiedUrl.protocol = 'https';
                         $(el).attr(attr, proxiedUrl.toString());

                     } else if (originalValue.startsWith('//') && canonicalOrigin) {
                         const absoluteUrlFromTarget = new URL(`https:${originalValue}`, selectedTargetUrl);
                          if (targetOrigin && (absoluteUrlFromTarget.origin === targetOrigin || (absoluteUrlFromTarget.host.endsWith('.' + new URL(selectedTargetUrl).hostname) && absoluteUrlFromTarget.origin.startsWith('http')))) {

                             let newPath = absoluteUrlFromTarget.pathname;
                             let prefix = '';
                             if (targetType === 'anime') {
                                 prefix = '/anime';
                             } else if (targetType === 'movies') {
                                 prefix = '/movies';
                             }
                             if (prefix !== '' && !newPath.startsWith(prefix + '/')) {
                                 newPath = prefix + newPath;
                             }

                            const proxiedUrl = new URL(newPath + absoluteUrlFromTarget.search + absoluteUrlFromTarget.hash, canonicalOrigin);
                            proxiedUrl.protocol = 'https';
                             $(el).attr(attr, proxiedUrl.toString());
                          }
                     }
                } catch (e) {
                    // console.warn(`[WARN] Could not parse URL "${originalValue}" for potential rewriting in main.ts:`, e);
                }
            }
        });
    });

    console.log(`[INFO] Rewrote internal URLs for ${targetType}.`);
}

function addJQueryIframePathScript($: cheerio.CheerioAPI): void {
    const script = `
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script>
$(document).ready(function() {
    $('iframe').each(function() {
        var src = $(this).attr('src');
        if (src) {
            try {
                var url = new URL(src, window.location.href);
                var pathnameWithPrefix = url.pathname;
                 $(this).attr('src', pathnameWithPrefix + url.search + url.hash);

            } catch (e) {
                console.error('Error processing iframe src:', src, e);
            }
        }
    });
});
</script>
`;
    const target = $('head').length ? $('head') : $('body');
    if (target.length) {
      target.append(script);
      console.log("[INFO] Added jQuery script for iframe path manipulation.");
    } else {
      console.warn("[WARN] Could not find <head> or <body> to add jQuery script.");
    }
}


export function transformHTML(html: string, canonicalUrl: string, targetOrigin: string | null, selectedTargetUrl: string, targetType: 'anime' | 'movies' | 'default'): string {
  console.log(`[INFO] Starting HTML transformation in main.ts for ${targetType} target.`);

  let $;
  try {
    $ = cheerio.load(html);
  } catch (e) {
    console.error("[ERROR] Failed to load HTML with Cheerio in main.ts:", e);
    return html;
  }

  removeUnwantedElements($, targetType);
  addLazyLoading($);
  rewriteUrls($, canonicalUrl, selectedTargetUrl, targetType);

  if (targetType === 'movies') {
     addJQueryIframePathScript($);
  }

  let processedHtml = '';
  try {
    processedHtml = $.html();
  } catch (e) {
    console.error("[ERROR] Failed to serialize HTML with Cheerio in main.ts:", e);
    return html;
  }

  if (!/^<!DOCTYPE\s+/i.test(processedHtml)) {
    processedHtml = "<!DOCTYPE html>\n" + processedHtml;
    console.log("[INFO] Added missing DOCTYPE.");
  }

  console.log(`[INFO] HTML transformation finished for ${targetType} target.`);
  return processedHtml;
}


// --- NEW Common Proxy Request Handler ---

/**
 * Handles fetching and processing of a proxied request with common logic.
 * This function contains the duplicated logic from animeHandler, moviesHandler, and default fallback.
 *
 * @param request - The incoming Request object.
 * @param requestUrl - The parsed URL of the incoming request.
 * @param canonicalUrl - The base URL of the proxy itself.
 * @param selectedTargetUrl - The determined target URL for this request.
 * @param targetType - The type of target ('anime', 'movies', 'default') for transformation logic.
 * @param corsHeaders - Headers for CORS.
 * @param filterHeaders - Reference to the filterRequestHeaders function.
 * @param transformHtml - Reference to the transformHTML function.
 * @param targetPathname - The pathname segment to use for the target URL (already adjusted for prefix).
 * @returns A Promise resolving to a Response object.
 */
export async function handleGeneralProxyRequest(
    request: Request,
    requestUrl: URL,
    canonicalUrl: string,
    selectedTargetUrl: string,
    targetType: 'anime' | 'movies' | 'default',
    corsHeaders: Headers,
    filterHeaders: typeof filterRequestHeaders,
    transformHtml: typeof transformHTML,
    targetPathname: string // Pathname after stripping the route prefix, e.g., '/' or '/some/page'
): Promise<Response> {
    try {
        const targetOrigin = new URL(selectedTargetUrl).origin;

        // Form the target URL for fetch
        const targetUrl = new URL(selectedTargetUrl);
        targetUrl.pathname = targetPathname; // Use the passed targetPathname
        targetUrl.search = requestUrl.search; // Copy original query string

        console.log(`[INFO] Fetching target URL for ${targetType}: ${targetUrl.toString()}`);

        const filteredHeaders = filterHeaders(request.headers);

        const targetResponse = await fetch(targetUrl.toString(), {
            method: request.method,
            headers: filteredHeaders,
            body: request.body,
            redirect: 'manual' // Handle redirects manually
        });

        console.log(`[INFO] Received response from ${targetType} target: Status ${targetResponse.status}`);

        // --- Penanganan Redirect 3xx ---
        if (targetResponse.status >= 300 && targetResponse.status < 400 && targetResponse.headers.has('location')) {
            const location = targetResponse.headers.get('location');
            if (!location) {
                console.error(`[ERROR] ${targetType} target redirect response missing Location header.`);
                const errorHeaders = new Headers(corsHeaders);
                return new Response("Internal Server Error: Invalid redirect response", { status: 500, headers: errorHeaders });
            }
            console.log(`[INFO] ${targetType} target responded with redirect to: ${location}`);
            try {
                // Resolving URL location relative to the targetUrl being fetched
                const redirectedUrl = new URL(location, targetUrl);
                let proxiedRedirectUrl = redirectedUrl.toString();
                const currentTargetOrigin = new URL(selectedTargetUrl).origin;
                const canonicalOrigin = new URL(canonicalUrl).origin;

                // Logic to rewrite redirect URL to point back to the proxy host
                // Check if the redirect is pointing to the origin of the current target or its subdomain
                // or if it's a relative path starting with '/'
                 if (currentTargetOrigin && (redirectedUrl.origin === currentTargetOrigin || (redirectedUrl.host.endsWith('.' + new URL(selectedTargetUrl).hostname) && redirectedUrl.origin.startsWith('http')) || (location.startsWith('/') && !location.startsWith('//')))) {

                      let prefix = '';
                      if (targetType === 'anime') {
                          prefix = '/anime';
                      } else if (targetType === 'movies') {
                          prefix = '/movies';
                      }
                      // Combine the original route prefix with the redirect path from the target
                      // Ensure the target redirect path starts with '/'
                      const targetRedirectPath = redirectedUrl.pathname;
                      let newPath = prefix + (targetRedirectPath.startsWith('/') ? targetRedirectPath : '/' + targetRedirectPath);

                      // Create a new URL with the proxy origin and the adjusted path
                      const finalRedirectUrl = new URL(newPath + redirectedUrl.search + redirectedUrl.hash, canonicalOrigin);
                      finalRedirectUrl.protocol = 'https'; // Ensure HTTPS
                      proxiedRedirectUrl = finalRedirectUrl.toString();

                      console.log(`[INFO] Rewrote ${targetType} redirect URL to proxy host (${canonicalOrigin}): ${proxiedRedirectUrl}`);

                 } else {
                      console.log(`[INFO] Redirecting ${targetType} to non-${targetType} domain or already relative path, passing through location.`);
                      // If redirecting to a different domain, pass through the URL as is (unless it's relative)
                      // Ensure the URL is absolute if it was originally relative to the proxy origin
                       if (!redirectedUrl.protocol.startsWith('http')) {
                           // If still relative (e.g., /path), make it absolute with the proxy origin
                           proxiedRedirectUrl = new URL(location, canonicalOrigin).toString();
                       } else {
                           // If already absolute to another domain, use the original URL
                           proxiedRedirectUrl = location;
                       }
                        // Ensure HTTPS if protocol exists
                       if (proxiedRedirectUrl.startsWith('http://')) {
                            proxiedRedirectUrl = proxiedRedirectUrl.replace('http://', 'https://');
                       }
                 }


                const redirectHeaders = new Headers(corsHeaders);
                // Copy headers from the target response except Location, Content-Encoding, Content-Length
                for (const [key, value] of targetResponse.headers) {
                     if (key.toLowerCase() !== 'location' && key.toLowerCase() !== "content-encoding" && key.toLowerCase() !== "content-length") {
                          redirectHeaders.set(key, value);
                     }
                }
                 // Set Location header with the rewritten URL
                redirectHeaders.set('Location', proxiedRedirectUrl);

                return new Response(null, {
                     status: targetResponse.status,
                     statusText: targetResponse.statusText,
                     headers: redirectHeaders,
                });

            } catch (e) {
                console.error(`[ERROR] Failed to process ${targetType} redirect location (${location}):`, e);
                 // Fallback response redirect if processing fails, copy original headers
                 const responseHeaders = new Headers(corsHeaders);
                 for (const [key, value] of targetResponse.headers) {
                    if (key.toLowerCase() !== "content-encoding" && key.toLowerCase() !== "content-length") {
                         responseHeaders.set(key, value);
                    }
                 }
                 return new Response(targetResponse.body, { // Body might be empty for 3xx
                     status: targetResponse.status,
                     statusText: targetResponse.statusText,
                     headers: responseHeaders,
                 });
            }
        }
        // --- Akhir Penanganan Redirect ---


        const contentType = targetResponse.headers.get("content-type") || "";
        console.log(`[INFO] ${targetType} target response Content-Type: ${contentType}`);

        if (contentType.includes("text/html")) {
            const htmlContent = await targetResponse.text();
            console.log(`[INFO] Processing ${targetType} HTML content.`);

            // Call transformHTML using the passed function reference
            const modifiedHtml = transformHtml(htmlContent, canonicalUrl, targetOrigin, selectedTargetUrl, targetType);

            const responseHeaders = new Headers(corsHeaders);
            // Copy headers from the target response except Content-Encoding, Content-Length, Content-Type
            for (const [key, value] of targetResponse.headers) {
                if (key.toLowerCase() !== "content-encoding" && key.toLowerCase() !== "content-length" && key.toLowerCase() !== "content-type") {
                    responseHeaders.set(key, value);
                }
            }
            // Set the correct Content-Type for the modified HTML
            responseHeaders.set("Content-Type", "text/html; charset=utf-8");

            return new Response(modifiedHtml, {
                status: targetResponse.status,
                statusText: targetResponse.statusText,
                headers: responseHeaders,
            });
        } else {
            // Proxy non-HTML assets directly
            console.log(`[INFO] Proxying non-HTML content for ${targetType}.`);
            const responseHeaders = new Headers(corsHeaders);
            // Copy headers from the target response except Content-Encoding, Content-Length
            for (const [key, value] of targetResponse.headers) {
                 if (key.toLowerCase() === "content-encoding" || key.toLowerCase() === "content-length") {
                     continue;
                 }
                 responseHeaders.set(key, value);
            }
            return new Response(targetResponse.body, { // Stream body
                status: targetResponse.status,
                statusText: targetResponse.statusText,
                headers: responseHeaders,
            });
        }
    } catch (error) {
        console.error(`[ERROR] Error fetching or processing ${targetType} target ${selectedTargetUrl}:`, error);
        return new Response("Internal Server Error", { status: 500, headers: corsHeaders });
    }
}
