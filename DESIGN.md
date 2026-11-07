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

## Repository Layout

```text
linkpage/
  .github/workflows/deploy.yml   # Build and deploy to Pages on push to main
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
expect to change once it meets real code.

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

The Pages source for the repository is set to "GitHub Actions" in the repo
settings. On every push to `main`, `.github/workflows/deploy.yml` runs:

1. Check out the repo and install dependencies with `npm ci`.
2. Run the media size check over `public/media/`.
3. Run `astro check` and `astro build`; schema and contrast validation run as
   part of the build.
4. Upload `dist/` and deploy it with the official Pages actions.

Pull requests run steps 1 through 3 without deploying, so a broken `site.json`
is caught before it reaches `main`. Locally the loop is `npm run dev` for a live
preview and `npm run build && npm run preview` to see exactly what will ship.

## Future Work

- The animated background itself, starting with one Canvas 2D effect.
- A custom domain via a `CNAME` file, which would also mean updating Astro's
  `site` setting.
- Additional embed providers as they come up.
