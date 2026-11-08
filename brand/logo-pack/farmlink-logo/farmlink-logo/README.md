# FarmLink logo pack

Four logo concepts for FarmLink. Each mark shows two shapes linked through each other: the landowner and the farmer. Pick one concept and delete the other folders, or keep them all while deciding.

| Folder | Concept | Best on |
|---|---|---|
| `a-leaf-link/` | Two leaves interlocked like chain links | White or light backgrounds |
| `b-sprout-link/` | Two linked rings with a sprout growing from the join (recommended) | White or light backgrounds |
| `c-plot-link/` | The familiar "link" icon, drawn as two planted plots | White or light backgrounds |
| `d-leaf-link-flat/` | Flat deep-green and lime version of the leaf link | Deep green backgrounds |

## Files in each folder

| File | Use |
|---|---|
| `mark.svg` | Main symbol, transparent background, for light backgrounds |
| `mark-reverse.svg` | Symbol for dark backgrounds (transparent) |
| `lockup.svg` | Symbol + "FarmLink" wordmark, for light backgrounds (navbar, documents) |
| `lockup-reverse.svg` | Symbol + wordmark on its dark background |
| `app-icon.svg` | Rounded-square icon with background |
| `favicon.svg`, `favicon.ico` | Browser tab icon |
| `png/` | PNG exports: marks at 256/512/1024 px, app icons at 512/192, `apple-touch-icon.png` (180) |

All SVGs are hand-written, clean and transparent where noted, so they can be inlined in HTML/React or imported as files.

## Colours

Concepts A, B, C

| Name | Hex | Role |
|---|---|---|
| Farm green | `#2E6B3A` | Primary brand colour, buttons, links |
| Harvest ochre | `#D08A2C` | Accent (second link), highlights |
| Ink | `#1F2A22` | Body text, "Farm" in the wordmark |
| Light ground | `#F4F6F2` | Page or panel background |

Concept D

| Name | Hex | Role |
|---|---|---|
| Deep green | `#05402E` | Primary background / brand colour |
| Lime | `#C8F06A` | Accent on deep green |
| Leaf green | `#8DBB55` | Second leaf on deep green |
| Field green | `#5E9A3A` | Second leaf on light backgrounds |

Do not put lime text on white: the contrast is too low. Use deep green on light backgrounds instead.

## Typography

Wordmark and headings: **Outfit SemiBold (600)**, Google Fonts. The lockup SVGs use live text that loads Outfit; when an SVG is used as an `<img>`, browsers block that font load, so either load Outfit on the page and inline the SVG, or build the lockup in markup (below). For a pixel-perfect file, open `lockup.svg` in Figma or Illustrator with Outfit installed and convert the text to outlines.

## Using it in the web app

Copy the chosen concept's files into the frontend's public/static folder, for example `public/brand/`.

Favicons in `<head>`:

```html
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/brand/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/brand/png/apple-touch-icon.png">
```

Navbar lockup built in markup (keeps the wordmark crisp and editable):

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@600&display=swap">

<a href="/" class="brand" aria-label="FarmLink home">
  <img src="/brand/mark.svg" alt="" width="40" height="40">
  <span class="brand-name">Farm<span>Link</span></span>
</a>

<style>
  .brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; }
  .brand-name { font-family: Outfit, sans-serif; font-weight: 600; font-size: 24px; letter-spacing: -0.02em; color: #1F2A22; }
  .brand-name span { color: #2E6B3A; }
</style>
```

CSS variables to start the theme:

```css
:root {
  --fl-green: #2E6B3A;
  --fl-ochre: #D08A2C;
  --fl-ink: #1F2A22;
  --fl-ground: #F4F6F2;
}
```

## Notes for Claude Code

- Treat the SVGs in this folder as the source of truth for the logo; do not redraw or restyle them.
- Use `mark.svg` on light surfaces and `mark-reverse.svg` on brand-green surfaces.
- Keep clear space around the mark of at least a quarter of its width, and do not show it smaller than 24 px.
