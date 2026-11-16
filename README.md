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
npm run build
npm run preview
```

The production output is generated in `dist/`. Deploy its contents to a static hosting service or your own web server. Deployment under a subdirectory is also supported. The site requires no backend APIs, accounts, or external font services.

## Configuration

Everyday settings are centralized in `src/config.ts`, with English comments. The display name and destination URLs are empty by default. Clicking an entry with an empty URL plays its opening animation and then returns to the portal. Once a full `https://` URL is configured, the browser navigates to it after the animation. Links retain native keyboard access, context menus, and Ctrl / Command click behavior.

| Setting | Default | Description |
| --- | --- | --- |
| `name` | Empty | Name in the upper-left corner; hidden when empty |
| `entries.*.url` | Empty | Independent destination URL for each entry |
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
| `leaves.maxFps` | 45 | Maximum leaf rendering frame rate |
| `motion.transitionSpeed` | 1 | Entry animation speed multiplier; higher values are faster |

Colors are defined with CSS variables in `src/styles.css`: `--qp-*` controls the paper surfaces and background, while `--leaf-*` controls the ginkgo leaves. Leaf shapes, veins, and shadows are drawn with Canvas and require no image assets.

## Interaction and accessibility

- Moving the mouse gently brushes nearby leaves. Clicking a leaf or an empty area creates a local gust; the wind button in the upper-right corner clears the page.
- Clicking a leaf covering an entry blows the leaf away first, preventing accidental navigation. Uncovered entry areas respond normally.
- Entries with empty URLs return to their original positions after the preview animation. Press Escape to cancel an opening animation.
- Theme preferences are saved in the browser. Theme switching still works when local storage is unavailable.
- Animations pause when the page is not visible. With reduced motion enabled, continuous movement stops and gusts clear leaves immediately.
- Mobile devices use separate leaf counts and a capped rendering pixel ratio. Toolbar buttons provide 44px touch targets on devices with coarse pointers.

## Project structure

- `src/config.ts`: everyday settings and type definitions
- `src/main.ts`: content and icon initialization
- `src/portal.ts`: themes, spring motion, opening animations, and navigation
- `src/leaves.ts`: leaf rendering, wind, replenishment, and hit detection
- `src/styles.css`: surface appearance, layout, and light/dark palettes
