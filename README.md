# Ginkgo & Wind

English | [简体中文](README-CN.md)

A standalone personal portal with a folded article sheet, a profile card, and layered notes linking to Blog, Profile, and Notes. It supports light, dark, and system themes, with interactive ginkgo leaves that respond to mouse movement and touch.

## Getting started

Requires Node.js 22.12 or later.

```sh
npm install
npm run dev
```

Open the local URL shown in the terminal. To check types, build for production, and preview the build locally:

```sh
npm run check
npm test
npm run verify
npm run build
npm run preview
```

The production output is generated in `dist/`. Deploy its contents to a static hosting service or your own web server. Deployment under a subdirectory is also supported. The site requires no backend APIs, accounts, or external font services.

## Configuration

Notes are authored as individual Markdown files in `content/notes/`. Copy `_template.md` to a new filename, edit the metadata and body, then set `draft: false`. Entries and categories are discovered automatically and sorted by date. Each note accepts `animation: unfold`, `lift`, `turn`, or `fade`. See [the writing guide](README-CN.md#写一篇随笔) for supported Markdown and metadata. Rebuild with `npm run build` before publishing changes.

Edit `config/site.config`, `config/profile.config`, and `config/notes.config` for site settings and page content. These are JSON files: use double quotes, no comments, and no trailing commas. See [the configuration guide](docs/configuration.md). Development reloads on save; production requires a rebuild. Notes links to `./notes.html` and Profile to `./profile.html`; Blog is empty by default. Clicking an entry with an empty URL plays its opening animation and then returns to the portal. Relative page paths and full HTTP(S) URLs navigate after the animation. Links retain native keyboard access, context menus, and Ctrl / Command click behavior.

| Setting | Default | Description |
| --- | --- | --- |
| `name` | `Ginkgo` | Shared wordmark; an empty value falls back to Ginkgo |
| `entries.*.url` | Notes: `./notes.html`; Profile: `./profile.html`; Blog empty | Relative path or destination URL for each entry |
| `defaultTheme` | `system` | Initial appearance; a visitor's saved preference takes precedence |
| `leaves.desktopCount` | 40 | Target leaf count on desktop |
| `leaves.mobileCount` | 26 | Target leaf count on mobile |
| `leaves.refillDelay` | 4 | Delay in seconds before cleared leaves begin returning |
| `leaves.refillInterval` | 0.32 | Interval in seconds between returning leaves |
| `leaves.breezeSpeed` | 1 | Natural wind speed multiplier |
| `leaves.gustStrength` | 1 | Click-induced gust strength multiplier |
| `leaves.pointerRadius` | 90 | Radius of the mouse's influence on leaves, in pixels |
| `leaves.clickRadius` | 225 | Click-induced gust radius; automatically reduced on mobile |
| `leaves.size` | 1 | Leaf size multiplier |
| `leaves.maxFps` | 60 | Maximum leaf rendering frame rate |
| `leaves.pixelBudget` | 1048576 | Foreground canvas pixel budget; lower saves memory |
| `motion.transitionSpeed` | 1 | Entry animation speed multiplier; higher values are faster |

Colors are defined with CSS variables in `src/pages/portal/styles.css`: `--qp-*` controls the paper surfaces and background, while `--leaf-*` controls the ginkgo leaves. Leaf shapes, veins, and shadows are drawn with Canvas and require no image assets.

## Interaction and accessibility

- Moving the mouse gently brushes nearby leaves. Clicking a leaf or an empty area creates a local gust; the wind button in the upper-right corner clears the page.
- Clicking a leaf covering an entry blows the leaf away first, preventing accidental navigation. Uncovered entry areas respond normally.
- Entries with empty URLs return to their original positions after the preview animation. Press Escape to cancel an opening animation.
- Hold the wind button for 700ms to clear leaves and pause generation; hold again to resume. A progress ring and pause badge show the state. Touch and Space/Enter holds are supported. The preference persists across both pages, refreshes and history navigation.
- Theme preferences are saved in the browser. Theme switching still works when local storage is unavailable.
- Animations pause when the page is not visible. With reduced motion enabled, continuous movement stops and gusts clear leaves immediately.
- Mobile devices use separate leaf counts and a capped rendering pixel ratio. Toolbar buttons provide 44px touch targets on devices with coarse pointers.

## Project structure

- `config/*.config`: JSON site, Profile, and Notes settings, separate from code.
- `content/notes/`: Markdown notes and authoring template.
- `src/pages/portal/`: homepage and entrance animation.
- `src/pages/notes/`: cards, filtering, reader, spring and layout motion.
- `src/pages/profile/`: profile rendering, disclosure motion, and print styles.
- `src/shared/`: theme, wordmark, early boot, transitions, and document styles.
- `src/effects/`: leaf engine and wind controls.
- `src/config/`: internal config types, validators, and imports.
- `build/config-plugin.ts`: compile validated config and synchronous first-paint settings.
- `scripts/`, `tests/`: config, content, motion, resource lifecycle, and build checks.

## Verification and release

Run `npm run verify` before publishing: it executes all tests, TypeScript checks, config and Markdown validation, the production build, and build-output checks. All three documents load their styles from HTML rather than waiting for JavaScript. Publish the entire `dist/` directory and use `npm run preview` for a production-mode visual check.

See [the architecture and maintenance notes](docs/architecture.md) for lifecycle details and browser checks. Automated checks do not replace visual verification on real browsers.


Profile is a single-column academic document based on Asipe's content structure. Edit `config/profile.config`; see [the configuration guide](docs/profile.md). Leaves start disabled on every Profile visit and use the same click-to-clear / hold-to-pause gestures and pause badge as other pages, without affecting their preferences. A4 print styles hide controls and reveal all records.
