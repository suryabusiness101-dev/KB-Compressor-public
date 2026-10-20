# KB Compressor

Compress an image to an exact file size in KB, which is useful for upload forms with a hard limit (passport and visa photos, DS-160, DV Lottery, college and job applications). Enter the KB target from the form and get the best-quality image that fits under it.

Everything runs in your browser. Your photo is never uploaded, stored or sent anywhere, because there is no backend.

**Live site:** https://pixtokb.com

## How it works

For JPEG and WebP, the compressor binary-searches the encoder quality to find the highest quality that still lands at or under the target size. It shrinks the image dimensions only when even the lowest quality is still too large. PNG has no lossy quality setting in the Canvas API, so PNG output is downscaled instead. See `src/lib/compress.ts`.

## Tech stack

- [Astro](https://astro.build) (static output) with TypeScript
- [Tailwind CSS v4](https://tailwindcss.com)
- HTML Canvas API for client-side image encoding
- `@astrojs/sitemap` for the sitemap
- Hosted on [Cloudflare Pages](https://pages.cloudflare.com). `functions/_middleware.js` redirects `www` to the apex domain and adds `noindex` on the `*.pages.dev` preview domain.

## Getting started

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev        # start the dev server at http://localhost:4321
npm run build      # build the static site into dist/
npm run preview    # serve the production build locally
```

### Deploying

The site is deployed to Cloudflare Pages with Wrangler:

```bash
npm run build
npx wrangler pages deploy dist --project-name=<your-project>
```

To deploy your own copy, change `site` in `astro.config.mjs`, the sitemap URL in `public/robots.txt`, the domain in `functions/_middleware.js`, and the Google Analytics ID in `src/layouts/Layout.astro`.

## Built with Claude Code

This project was built with [Claude Code](https://claude.com/claude-code).
