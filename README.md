# Northbound website

Static site, no dependencies. Needs Node 18+.

    node build.mjs                          # builds to dist/
    SITE_URL=https://yourdomain.com node build.mjs   # production build (sets canonical, OG, sitemap, schema URL)
    python3 -m http.server 8000 -d dist     # preview

- Pages live in `src/pages/*.html` (first block is `<!--meta {...}-->` with path, title, description, schema).
- Shared header/footer/logo are in `src/partials/`. Layout shell is `src/layout.html`.
- Styles: `assets/css/styles.css` (tokens at the top). Script: `assets/js/main.js`.
- Placeholders are marked with the `.ph` class so they stay visible until replaced.
