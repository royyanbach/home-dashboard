# Home Dashboard

My personal mobile web dashboard for home automations

## Stack

- [React](https://react.dev/) + [Vite](https://vite.dev/)
- [Astryx](https://astryx.design/) UI components and neutral theme
- [React Router](https://reactrouter.com/) for client-side navigation
- [Tailwind CSS](https://tailwindcss.com/) (via Astryx token utilities)

## Getting started

```sh
npm install
cp .env.example .env   # then edit URLs for your environment
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the development server         |
| `npm run build`   | Production build to `dist/`          |
| `npm run preview` | Serve the production build locally   |
| `npm run format`  | Format the codebase with Prettier    |

## Progressive Web App

This project is configured as a PWA via [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/).

- **Installable** — add to your home screen from mobile Safari or Chrome.
- **Offline app shell** — the UI loads from cache; clips and live frames use network-first caching when configured.
- **Auto-updates** — new deployments refresh the service worker in the background.

After `npm run build`, verify locally:

```sh
npm run preview
```

Then open DevTools → Application → Manifest / Service Workers, or use Lighthouse’s PWA audit.

PWA icons live in `public/` (`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`, `favicon.png`), generated from `public/images/logo.png`.

## Routes

| Path                    | Screen                                      |
| ----------------------- | ------------------------------------------- |
| `/`                     | Home — live frame and recent snapshots      |
| `/snapshots`            | History — clips grouped by day              |
| `/snapshots/:snapshotId`| Detail — full-screen video with metadata    |

## Project layout

```
├── public/images/   Static assets (e.g. placeholder poster image)
├── src/
│   ├── config.js    Env-backed app configuration
│   ├── main.jsx     App entry, routes, and screens
│   └── index.css    Astryx + Tailwind theme imports
├── index.html
└── vite.config.js
```

## Configuration

Copy `.env.example` to `.env` and set:

| Variable              | Description                                      |
| --------------------- | ------------------------------------------------ |
| `VITE_CLIPS_API_URL`  | Paginated clips API base URL                     |
| `VITE_CLIPS_HOST`     | Media host for video and thumbnail files         |
| `VITE_CAMERA_ID`      | Camera slug for the live frame (default: `cam1`) |

The live frame URL is derived as `{VITE_CLIPS_HOST}/clips/{VITE_CAMERA_ID}/latest-frame.jpg`.

Vite exposes only `VITE_*` variables to the client. Restart the dev server after changing `.env`.

## AI agents

See [AGENTS.md](./AGENTS.md) for Astryx-specific guidance when editing UI with coding agents.
