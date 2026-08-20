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

## Deployment

Klarlauf deploys to Cloudflare Workers and uses a D1 database bound as `DB`. Before the first deployment, replace the placeholder database ID in `wrangler.jsonc` with the ID created in the Cloudflare dashboard, then apply the migration in `drizzle/`.
