# Home Dashboard

A mobile-first web app for browsing front porch camera clips. Browse a live frame, recent snapshots, and full clip history with inline video playback.

## Stack

- [React](https://react.dev/) + [Vite](https://vite.dev/)
- [Astryx](https://astryx.design/) UI components and neutral theme
- [React Router](https://reactrouter.com/) for client-side navigation
- [Tailwind CSS](https://tailwindcss.com/) (via Astryx token utilities)

## Getting started

```sh
npm install
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
│   ├── main.jsx     App entry, routes, and screens
│   └── index.css    Astryx + Tailwind theme imports
├── index.html
└── vite.config.js
```

## Configuration

Clip and media URLs are defined at the top of `src/main.jsx`:

- **Clips API** — paginated list of recordings
- **Media host** — base URL for video and thumbnail files
- **Latest frame** — live JPEG from the camera

Update those constants to point at your own endpoints.

## AI agents

See [AGENTS.md](./AGENTS.md) for Astryx-specific guidance when editing UI with coding agents.
