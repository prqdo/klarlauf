# Klarlauf

Klarlauf is a full-stack order-management dashboard for small creative teams. It keeps client work visible from intake to delivery without turning the workflow into a heavy project-management system.

## Features

- Create orders with server-side validation
- Search by client, project, or order ID
- Filter orders by workflow stage
- Edit order details and status
- Delete orders with confirmation
- Persist changes in Cloudflare D1
- Use the interface on desktop and mobile

## Stack

- React 19 and TypeScript
- vinext and Vite
- Cloudflare Workers and D1
- Drizzle ORM and SQLite
- Custom responsive CSS

## Implementation notes

This is a personal project with fictional sample orders. The interface keeps
search and status filters in the browser and uses the API to save changes.
English and German labels are defined in `app/copy.ts`.

The API validates order fields before writing to D1. Monetary values are stored
as integer cents and converted to euros in API responses. Orders have a numeric
database ID and a separate display ID, such as `OF-1045`.

The live demo uses one shared order list. User accounts and separate workspaces
are possible future extensions.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/orders` | List orders |
| `POST` | `/api/orders` | Create an order |
| `PATCH` | `/api/orders/:id` | Update an order |
| `DELETE` | `/api/orders/:id` | Delete an order |

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Run the checks before committing:

```bash
npm run lint
npm test
```

`npm test` builds the application and runs two kinds of checks:

- A rendering check confirms the page returns HTML with its main labels.
- API tests run the built Worker against a temporary local D1 database. They
  create, retrieve, update and delete orders, check monetary values, and verify
  that invalid requests leave the stored data intact.

## Deployment

Klarlauf deploys to Cloudflare Workers and uses a D1 database bound as `DB`. Before the first deployment, connect the D1 database in `wrangler.jsonc`, then apply the SQL files in `migrations/`.
