"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/lib/clerk-auth";

export async function refreshAction() {
  revalidatePath("/dashboard");
}

export async function signOutAction() {
  await signOut();
  revalidatePath("/", "layout");
}

export async function approveAction(formData: FormData) {
  const requestId = formData.get("requestId") as string;
  const { serviceClient } = await import("@/modules/db/client");
  const db = serviceClient();

  const { data: request, error: requestError } = await db
    .from("vendor_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    throw new Error("Failed to fetch vendor request");
  }

  const { error: insertError } = await db
    .from("vendors")
    .insert({
      slug: request.vendor_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      name: request.vendor_name,
      homepage: null,
      spec_url: request.spec_or_docs_url || "",
      spec_format: "openapi3",
      changelog: { type: "none" },
      poll_interval_minutes: 60,
      poll_offset_minutes: 0,
      status: "active",
    });

  if (insertError) {
    throw new Error("Failed to create vendor entry");
  }

  const { error: deleteError } = await db
    .from("vendor_requests")
    .delete()
    .eq("id", requestId);

  if (deleteError) {
    throw new Error("Failed to remove vendor request");
  }
}

export async function rejectAction(formData: FormData) {
  const requestId = formData.get("requestId") as string;
  const { serviceClient } = await import("@/modules/db/client");
  const db = serviceClient();

  const { error } = await db
    .from("vendor_requests")
    .delete()
    .eq("id", requestId);

  if (error) {
    throw new Error("Failed to reject vendor request");
  }
}