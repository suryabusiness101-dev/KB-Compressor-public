// Cloudflare Pages Function: adds X-Robots-Tag: noindex on the *.pages.dev
// domain only, leaving the custom domain (pixtokb.com) indexable.
//
// A static /public/_headers file can't do this because Pages' _headers
// format matches on request path, not hostname — the same _headers rules
// apply identically to pixtokb.com and pixtokb.pages.dev since they serve
// the same build. This middleware runs per-request and checks the hostname
// instead.
export const onRequest = async ({ request, next }) => {
  const url = new URL(request.url);
  const { hostname } = url;

  // www.pixtokb.com → apex, 301, preserving path + query string.
  // GSC found pages indexed inconsistently across www and apex (no redirect
  // between the two identical builds), splitting ranking signals. Done here
  // rather than as a Cloudflare Bulk Redirect so it lives in version control
  // and deploys atomically with the site.
  if (hostname === 'www.pixtokb.com') {
    url.hostname = 'pixtokb.com';
    return Response.redirect(url.toString(), 301);
  }

  const response = await next();

  if (hostname.endsWith('.pages.dev')) {
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag', 'noindex');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  return response;
};
