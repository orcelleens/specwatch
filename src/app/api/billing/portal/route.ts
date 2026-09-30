import { getUser } from "@/lib/supabase-server";
import { createPortalSession } from "@/modules/billing/polar";

export async function POST() {
  const user = await getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const url = await createPortalSession({ userId: user.id });
    return Response.json({ url });
  } catch {
    return Response.json({ error: "no polar customer on file" }, { status: 400 });
  }
}