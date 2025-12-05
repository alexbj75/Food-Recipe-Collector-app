# Food Recipe Collector App

Full-stack recipe collector: paste any online recipe URL, the backend scrapes and normalizes it, stores it in MariaDB, and the frontend renders a clean, unified view with filtering and deletion.

## Project structure

- `backend/` — Express API, MariaDB pool + scraper
- `frontend/` — vanilla HTML/CSS/JS UI (served by the backend)

## Prerequisites

- Node.js 20.18.1+ (Cheerio/undici dependency chain requires this)
- MariaDB instance you can reach from where the API runs

## Setup

1. `cd recipes-app/backend`
2. `cp .env.example .env` and set values:
   ```
   DB_HOST=your_host
   DB_PORT=your_port
   DB_USER=your_user
   DB_PASSWORD=your_password
   DB_NAME=recipes_app
   PORT=4000        # or any port you prefer
   ALLOW_ORIGIN=*   # lock down in production
   ```
3. Install deps: `npm install`
4. Start API + static frontend: `npm run dev` (or `npm start` for production)
5. Open `http://localhost:4000` to use the app.

The server creates the `recipes` table on startup if needed.

## API (REST)

- `GET /api/recipes?q=` — list recipes (optional search on title/source)
- `GET /api/recipes/:id` — fetch a recipe
- `POST /api/recipes/import` — body `{ "url": "https://..." }` to scrape + store
- `DELETE /api/recipes/:id` — delete
- `GET /api/health` — health check

Responses are normalized to a common shape with ingredients/instructions arrays.

## Notes on deployment

- Backend serves the static frontend from `frontend/`; deploy the backend container/app and keep env vars pointed at the OSC MariaDB instance.
- CORS is permissive by default (`ALLOW_ORIGIN=*`). Restrict in production.
- Connection pooling is enabled via `mysql2` with sensible defaults; tune `connectionLimit` if needed.
- If you redeploy or rotate credentials, update the `.env` and restart.

## Frontend UX

- Modern, responsive layout with filter box, delete controls, and a unified detail view.
- Normalized presentation of prep/cook/total time, servings, ingredients, and instructions.
- Works without bundlers; plain HTML/CSS/JS.
