import { deleteOrder, orderStatuses, updateOrder } from "@/db";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected database error";
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as Record<string, unknown>;
    const client = typeof payload.client === "string" ? payload.client.trim() : "";
    const project = typeof payload.project === "string" ? payload.project.trim() : "";
    const due = typeof payload.due === "string" ? payload.due : "";
    const value = typeof payload.value === "number" ? payload.value : Number.NaN;
    const status = typeof payload.status === "string" && orderStatuses.includes(payload.status as (typeof orderStatuses)[number])
      ? payload.status as (typeof orderStatuses)[number]
      : null;

    if (!client || !project || !/^\d{4}-\d{2}-\d{2}$/.test(due) || !Number.isFinite(value) || value <= 0 || !status) {
      return Response.json(
        { error: "Client, project, valid due date, positive value, and valid status are required." },
        { status: 400 },
      );
    }

    const order = await updateOrder(id, { client, project, due, value, status });
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    return Response.json({ order });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deleted = await deleteOrder(id);
    if (!deleted) return Response.json({ error: "Order not found." }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
