import { auth } from "@clerk/nextjs/server";
import { createPortalSession } from "@/modules/billing/polar";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const url = await createPortalSession({ userId });
    return Response.json({ url });
  } catch {
    return Response.json({ error: "no polar customer on file" }, { status: 400 });
  }
}
