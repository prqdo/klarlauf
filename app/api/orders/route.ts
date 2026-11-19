import { insertOrder, listOrders } from "@/db";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected database error";
}

export async function GET() {
  try {
    return Response.json({ orders: await listOrders() });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const client = typeof payload.client === "string" ? payload.client.trim() : "";
    const project = typeof payload.project === "string" ? payload.project.trim() : "";
    const due = typeof payload.due === "string" ? payload.due : "";
    const value = typeof payload.value === "number" ? payload.value : Number.NaN;

    if (!client || !project || !/^\d{4}-\d{2}-\d{2}$/.test(due) || !Number.isFinite(value) || value <= 0) {
      return Response.json(
        { error: "Client, project, valid due date, and a positive value are required." },
        { status: 400 },
      );
    }

    return Response.json({ order: await insertOrder({ client, project, due, value }) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
