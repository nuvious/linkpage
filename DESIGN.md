# linkpage Design

linkpage is a self-hosted replacement for Linktree: a single page with an
avatar, a short bio, and a list of links, built by Astro into static files and
published to a GitHub Pages user site. Everything a visitor sees is driven by
one JSON file, so updating the page means editing that file and pushing, and the
build and deploy happen in a GitHub Action without any further hands on it.

The page supports basic multimedia (images, video, audio, and small galleries)
alongside plain links, and it reserves a slot for an animated canvas background
that will be built later. Beyond that the goal is to stay small; if a feature
needs a server, a database, or an account somewhere, it doesn't belong here.

## Goals

- One page, rendered to static HTML at build time, readable with JavaScript
  disabled (embeds and the background degrade, the links do not).
- All content in a single `site.json` validated against a schema, such that a
  typo or a missing field fails the build instead of shipping a broken page.
- Multimedia items that can come from a third-party embed, a file committed to
  the repo, or a remote URL, chosen per item.
- Third-party embeds that load nothing from the third party until the visitor
  clicks them.
- Automatic light and dark themes following `prefers-color-scheme`, with the
  palette configurable from `site.json`.
- A pluggable background slot that a Canvas 2D animation can drop into without
  touching the rest of the layout.

## Non-Goals

- Analytics of any kind. No counters, pixels, or tracking scripts.
- Multiple pages, multiple profiles, or a CMS / admin UI.
- Scheduled or expiring links. This would only take effect on rebuild anyway,
  which makes it more confusing than useful without a scheduled Action.
- A manual theme toggle. The system preference decides.
- Serving media through Git LFS, since GitHub Pages does not serve LFS objects
  (it serves the pointer file instead, which is a fun way to break a video).

## Core Standards

> [!WARNING]
> Pending confirmation. Proposed resolution, not yet reviewed by the user.

These three properties are what a reviewer fails a diff on. Each one names the
test that catches a violation, since a standard nothing checks is a slogan.

1. **No third-party request at page load.** A visitor's browser contacts no
   host other than the page's own origin until they click an embed facade; that
   includes thumbnails, fonts, and scripts. YouTube thumbnails are fetched at
   build time and served from `dist/`. Caught by a Playwright test that records
   every request a fresh page load makes and fails on any off-origin URL.
2. **Links work with JavaScript disabled.** Every `link` item, every facade's
   fallback link, and every native media element renders and works with no
   client script; only the embed swap and the background need JavaScript.
   Caught by a Playwright test that runs the built page with JavaScript off.
3. **Bad content fails the build, never the page.** A schema violation, a
   missing `alt`, an invalid or low-contrast color, an unknown embed provider,
   or a file over 10 MB under `public/media/` exits non-zero before anything
   deploys. Caught by fixture builds that are required to fail, one per rule.

## Stack

| Concern | Choice | Reason |
|-|-|-|
| Generator | Astro, static output | Zero client JS by default, and islands keep the embed facade and background isolated |
| Content | `src/data/site.json` via a content collection | Astro's `file()` loader plus a Zod schema validates it at build |
| Styling | Plain CSS with custom properties | Theme tokens map directly from JSON; no framework needed |
| Client JS | Two small islands only | Embed facade and background canvas |
| Hosting | GitHub Pages user site | Free, served at `https://<username>.github.io/` |
| CI/CD | GitHub Actions with `withastro/action` | Builds and deploys on push to `main` |

**NOTE:** a user site requires the GitHub repository to be named
`<username>.github.io`. The local folder is `linkpage`, which is fine; the
remote name is what GitHub cares about. Because it's a user site the page is
served from the domain root, so Astro's `base` stays at `/` and `site` is set to
`https://<username>.github.io`.

The Astro version is whatever the current major is when the project is
bootstrapped, pinned in `package.json` and the lockfile. We use npm and commit
`package-lock.json` so the Action builds exactly what was tested locally.

> [!WARNING]
> Pending confirmation. Proposed resolution, not yet reviewed by the user.

At bootstrap that's Astro 7 (7.4.7 on the npm registry, checked 2026-11-07) on
Node.js 24 LTS, which is also the default `withastro/action` builds with. The
exact pins for the toolchain around it live in
[CONTRIBUTING.md](CONTRIBUTING.md#dependencies).

## Repository Layout

> [!WARNING]
> Pending confirmation. Proposed resolution, not yet reviewed by the user.

The tree below is the site itself; the development scaffolding around it
(`Makefile`, `docker/`, `tests/`, `scripts/`, `.devcontainer/`, `backlog/`, and
the contributor docs) is laid out in
[CONTRIBUTING.md](CONTRIBUTING.md#project-layout). Embed URL builders and the
contrast check live in `src/lib/` so they can be unit tested without rendering
anything.

```text
linkpage/
  .github/workflows/verify.yml   # The gate on every push and pull request
  .github/workflows/deploy.yml   # Verify, build, and deploy to Pages on push to main
  astro.config.mjs               # site URL, static output
  package.json
  public/
    media/                       # Self-hosted audio, video, and images served as-is
    favicon.svg
  src/
    content.config.ts            # Collection definition and Zod schema for site.json
    data/site.json               # All page content
    assets/                      # Images that go through astro:assets optimization
    components/
      Profile.astro
      Section.astro
      LinkItem.astro
      VideoItem.astro
      AudioItem.astro
      ImageItem.astro
      Gallery.astro
      EmbedFacade.astro          # Click-to-load wrapper for third-party iframes
      Background.astro           # Background slot; empty until the canvas lands
    layouts/Base.astro           # html/head, meta and Open Graph tags, theme tokens
    lib/
      embeds.ts                  # One URL builder per embed provider
      contrast.ts                # WCAG contrast ratio used by the schema
    pages/index.astro
    styles/global.css
  DESIGN.md
```

## Content Model

`site.json` has three top-level parts: the profile, the theme, and an ordered
list of sections. Each section has an optional heading and an ordered list of
items, and each item has a `type` that decides which component renders it.
Sections give us grouping ("Socials", "Projects", "Music") without introducing
any other structure; a page that doesn't want groups uses one section with no
heading.

```json
{
  "profile": {
    "name": "Jane Example",
    "bio": "Builds things, breaks things, writes about both.",
    "avatar": { "src": "/media/avatar.jpg", "alt": "Jane at a desk" }
  },
  "meta": {
    "title": "Jane Example",
    "description": "Links to everything Jane does.",
    "ogImage": "/media/og.png"
  },
  "theme": {
    "light": { "bg": "#f7f5f2", "fg": "#1c1b1a", "accent": "#2f6fdf", "card": "#ffffff" },
    "dark":  { "bg": "#121212", "fg": "#ecebe9", "accent": "#7aa7ff", "card": "#1e1e1e" }
  },
  "background": { "enabled": false, "effect": "none" },
  "sections": [
    {
      "heading": "Socials",
      "items": [
        { "type": "link", "label": "GitHub", "url": "https://github.com/example", "icon": "/media/icons/github.svg" }
      ]
    },
    {
      "heading": "Music",
      "items": [
        { "type": "audio", "title": "Demo track", "source": { "kind": "local", "src": "/media/demo.mp3" } },
        { "type": "audio", "title": "Album", "source": { "kind": "embed", "provider": "spotify", "id": "4aawyAB9vmqN3uQ7FjRGTy" } },
        { "type": "video", "title": "Talk", "source": { "kind": "embed", "provider": "youtube", "id": "dQw4w9WgXcQ" } },
        { "type": "video", "title": "Clip", "source": { "kind": "remote", "src": "https://cdn.example.com/clip.mp4", "poster": "https://cdn.example.com/clip.jpg" } }
      ]
    },
    {
      "heading": "Photos",
      "items": [
        { "type": "gallery", "images": [ { "src": "/media/a.jpg", "alt": "Sunrise over the bay" } ] }
      ]
    }
  ]
}
```

Item types for the first version:

- `link`: label, URL, and an optional icon or thumbnail.
- `image`: a single image with required `alt`, optionally wrapped in a link.
- `gallery`: a small grid of images, each with required `alt`.
- `video`: a `source` of kind `embed`, `local`, or `remote`.
- `audio`: a `source` of kind `embed`, `local`, or `remote`.

The `source` object is a discriminated union in the Zod schema. `local` and
`remote` both render a native `<video>` or `<audio>` element and differ only in
where the file lives; `embed` names a provider and an ID and renders through
the facade. Supported embed providers are YouTube, Vimeo, Spotify, and
SoundCloud to start, each as a small URL builder in one module so adding a
provider is a single entry. `alt` is required on every image in the schema
rather than encouraged in a README, since that is the only way it reliably
happens.

### Loading site.json

> [!WARNING]
> Pending confirmation. Proposed resolution, not yet reviewed by the user.

Astro's `file()` loader treats a JSON array as a list of entries with `id`
fields, and a JSON object as a map whose top-level keys are the entry ids
(Astro docs, Content collections, "The file() loader",
https://docs.astro.build/en/guides/content-collections/, checked 2026-11-07).
Fed `site.json` as written it would produce five entries (`profile`, `meta`,
`theme`, `background`, `sections`) with five different shapes, which no single
schema describes cleanly. The collection is therefore defined with a custom
parser that wraps the whole document as one entry:

```ts
const site = defineCollection({
  loader: file("src/data/site.json", {
    parser: (text) => ({ site: JSON.parse(text) }),
  }),
  schema: siteSchema,
});
```

`site.json` keeps exactly the shape shown above, the page reads it with
`getEntry("site", "site")`, and one Zod schema (imported from `astro/zod`, which
re-exports Zod 4) validates all of it.

## Media Hosting

Every media item picks its own host, and the right one depends mostly on file
size. GitHub caps individual files at 100 MB, warns at 50 MB, and wants
repositories under roughly 1 GB, and every byte committed stays in history
forever even after the file is deleted.

| Source kind | Where it lives | Good for | Cost |
|-|-|-|-|
| `local` | `public/media/` in the repo | Avatar, icons, photos, short clips | Repo size, permanent in history |
| `remote` | A bucket or CDN (R2, S3, etc.) | Long audio, full videos | Another account and possibly egress fees |
| `embed` | The provider | Anything already on YouTube, Spotify, etc. | Third-party privacy, mitigated by the facade |

The working rule is that anything over 10 MB goes `remote` or `embed`. A CI
step fails the build if any file under `public/media/` exceeds that, so the
rule is enforced rather than remembered.

Images referenced from `src/assets/` go through `astro:assets` and get resized
and converted to modern formats at build time; images in `public/media/` are
served untouched. The avatar and gallery images should live in `src/assets/`
for that reason, and I'm not yet sure how cleanly a path string in JSON resolves
to an `astro:assets` import, so the first implementation may need a small
lookup with `import.meta.glob`. That's the one part of the content model I
expect to change once it meets real code, and it's tracked under
[Open Questions](#open-questions).

## Embed Facade

Third-party iframes are not rendered at build time. `EmbedFacade.astro` renders
a button containing a thumbnail, the item title, and a play icon, and a small
script swaps it for the real iframe on click. Until that click the visitor's
browser makes no request to the provider, which keeps the page fast and keeps
YouTube from learning who visited a link page.

Thumbnails for embeds are fetched at build time where the provider makes that
possible (YouTube's thumbnail URLs are predictable from the ID) and stored in
the build output, so even the thumbnail isn't a third-party request. Providers
without a predictable thumbnail fall back to a generic styled placeholder, or a
`thumbnail` field set on the item. Without JavaScript the facade degrades to a
plain link to the content on the provider's site.

YouTube embeds use the `youtube-nocookie.com` domain once loaded.

> [!WARNING]
> Pending confirmation. Proposed resolution, not yet reviewed by the user.

The build-time thumbnail fetch is the project's only external service
connection, and it is not allowed to block a deploy. If the request to
`i.ytimg.com` fails or times out, the build prints a warning naming the item and
renders the generic placeholder for it instead; a missing thumbnail is a
cosmetic gap, unlike a broken `site.json`, so it does not fall under core
standard 3. Tests stub the fetch, so the gate never needs the network. The fetch
is built with the embed facade, not in the foundation epic (decided 2026-11-07).

## Theming

Theme colors in `site.json` become CSS custom properties on `:root` in the base
layout, with the `dark` set applied under
`@media (prefers-color-scheme: dark)`. Components only ever reference the
tokens (`var(--bg)`, `var(--accent)`, and so on), never raw colors, so changing
the palette is a JSON edit. The schema checks that each value is a valid CSS
color and that both `light` and `dark` define the same keys.

Layout is a single centered column, capped around 36rem, with a 16px side
gutter so it works at phone width without horizontal scroll. Link items are
full-width cards with a minimum 44px tap target.

## Animated Background

The background is not built in the first version, but the layout is shaped
around it now so adding it later doesn't mean restructuring the page.
`Background.astro` renders a fixed, full-viewport `<canvas>` behind the content
column (`z-index` below everything, `pointer-events: none`) when
`background.enabled` is true, and nothing at all when it's false.

The canvas is driven by a Canvas 2D island script that loads after the page is
interactive. Effects (particles, drifting gradients, a noise field) are modules
exporting `init`, `frame`, and `resize`, selected by `background.effect`, so
each effect is self-contained and swappable. The script has to respect a few
rules regardless of the effect:

- Render a single static frame, or nothing, when
  `prefers-reduced-motion: reduce` is set.
- Pause the animation loop when the tab is hidden (`visibilitychange`).
- Read colors from the theme tokens so the background follows light and dark.
- Cap the device pixel ratio at 2 so a high-DPI phone doesn't burn its battery
  on a decoration.

Content cards keep an opaque or near-opaque `--card` background so text
contrast never depends on what the canvas is doing underneath.

## Metadata and SEO

The base layout emits a title, description, canonical URL, and Open Graph and
Twitter card tags from the `meta` block, so a shared link produces a preview
card in chat and social apps. `ogImage` should be a 1200x630 image, and it must
be an absolute URL in the output, which the layout builds from Astro's `site`
setting. A `favicon.svg` ships in `public/`.

## Accessibility

- Every image has required `alt` text (empty string allowed for decorative
  icons next to a text label).
- Native `<audio>` and `<video>` elements always render their controls; no
  autoplay.
- The embed facade is a real `<button>` with an accessible name that includes
  the item title.
- Focus styles are visible and use the accent token.
- Color tokens are checked for at least 4.5:1 contrast between `fg` and both
  `bg` and `card` as part of the build; a failing palette fails the build.

## Build and Deployment

> [!WARNING]
> Pending confirmation. Proposed resolution, not yet reviewed by the user.

The site is distributed as a GitHub Pages user site and nothing else: no
container image, no package, no release artifact. The repository on GitHub is
`nuvious/nuvious.github.io`, Astro's `site` is `https://nuvious.github.io`, and
`base` stays unset because a `<username>.github.io` repository is served from
the domain root (Astro docs, "Deploy your Astro Site to GitHub Pages",
https://docs.astro.build/en/guides/deploy/github/, checked 2026-11-07). Creating
that repository and setting its Pages source to "GitHub Actions" are one-time
manual steps, listed in [CONTRIBUTING.md](CONTRIBUTING.md#publishing).

Two workflows share one definition of "verified", the `make verify` gate
described in [CONTRIBUTING.md](CONTRIBUTING.md#the-gate):

1. `.github/workflows/verify.yml` runs on every push and pull request, builds
   the dev image, and runs `make verify` inside it. The gate covers the media
   size check, `astro check`, `astro build` (where schema and contrast
   validation run), and the tests, so a broken `site.json` is caught before it
   reaches `main`.
2. `.github/workflows/deploy.yml` runs on push to `main`: it runs the same gate
   first, then `withastro/action@v6` installs with `npm ci`, builds, and uploads
   `dist/`, and `actions/deploy-pages@v5` publishes it.

Day-to-day work lands on the `dev` branch, and publishing is a deliberate merge
of `dev` into `main`, since every push to `main` is a production deploy. Locally
the loop is `npm run dev` for a live preview and
`npm run build && npm run preview` to see exactly what will ship.

## Decisions

> [!WARNING]
> Pending confirmation. Proposed resolution, not yet reviewed by the user.

These are deliberate "not for this project" choices, recorded so that a later
session doesn't mistake them for gaps or deferred work.

- **No versioned releases** (decided 2026-11-07). Nothing consumes a version
  number; a merge to `main` is the release, and the deploy is the artifact. No
  `version` field is maintained, nothing is tagged, and `/orchestrator-release`
  does not apply. `CHANGELOG.md` is still kept, with entries headed by the date a
  change was published and written for someone who reads the page rather than
  the code ([CONTRIBUTING.md](CONTRIBUTING.md#documentation)).
- **No generated API documentation** (decided 2026-11-07). The project exposes
  no library API; its one public interface is `site.json`, which the Zod schema
  enforces and `README.md` documents for the person editing it. TypeDoc or a
  JSON Schema export would document code nobody imports.
- **No architecture decision records** (decided 2026-11-07). The project is
  small enough that this document carries its decisions directly.

## Open Questions

> [!WARNING]
> Pending confirmation. Proposed resolution, not yet reviewed by the user.

- **Resolving image paths in site.json to `astro:assets`.** Astro's `image()`
  schema helper validates a relative image path and imports it as
  `ImageMetadata` (Astro docs, Images, "Images in content collections",
  https://docs.astro.build/en/guides/images/, checked 2026-11-07), but the docs
  show it only with Markdown frontmatter, not with a `file()`-loaded JSON
  document. Try `image()` first; if it doesn't resolve paths from `site.json`,
  fall back to an `import.meta.glob` lookup over `src/assets/`. The walking
  skeleton epic settles this and replaces this entry with the answer.

## Future Work

- The animated background itself, starting with one Canvas 2D effect.
- A custom domain via a `CNAME` file, which would also mean updating Astro's
  `site` setting.
- Additional embed providers as they come up.
