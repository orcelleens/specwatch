import { auth, clerkClient } from "@clerk/nextjs/server";
import { Check, User, Calendar } from "lucide-react";
import { serviceClient } from "@/modules/db/client";
import { Button } from "@/components/ui/button";
import { approveAction, rejectAction } from "../actions";

interface VendorRequest {
  id: string;
  user_id: string;
  vendor_name: string;
  spec_or_docs_url: string | null;
  note: string | null;
  created_at: string;
  user_email?: string;
}

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "Vendor Requests - SpecWatch Admin",
    description: "Review and approve vendor requests for SpecWatch",
  };
}

export default async function AdminVendorRequestsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  // Check if user is admin using environment variable
  const isAdmin = userId && process.env.ADMIN_USER_IDS?.includes(userId);
  if (!isAdmin) {
    // Not an admin, redirect to regular dashboard
    return null; // In a real app, you'd redirect to /dashboard
  }

  const db = serviceClient();
  const { data: vendorRequests, error: requestsError } = await db
    .from("vendor_requests")
    .select("id, user_id, vendor_name, spec_or_docs_url, note, created_at")
    .order("created_at", { ascending: false });

  if (requestsError) {
    // In a real app, you'd show an error message
    return null;
  }

  const requests = (vendorRequests ?? []) as VendorRequest[];

  // Fetch user emails for display
  const requestsWithEmails = await Promise.all(
    requests.map(async (request) => {
      try {
        const client = await clerkClient();
        const user = await client.users.getUser(request.user_id);
        const email = user.emailAddresses.find(
          (address) => address.id === user.primaryEmailAddressId
        )?.emailAddress;
        return { ...request, user_email: email };
      } catch {
        return { ...request, user_email: null };
      }
    })
  );

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">
            Vendor Requests
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Review and approve vendor requests from users
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium">
            {requestsWithEmails.length} pending requests
          </span>
          {requestsWithEmails.length > 0 && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                // TODO: Implement bulk approve
              }}
              className="hover:text-zinc-200"
            >
              Approve All
            </Button>
          )}
        </div>
      </header>

      {requestsWithEmails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center">
            <Check className="mx-auto mb-4 text-zinc-600" size={32} />
            <p className="text-sm text-zinc-500">No pending vendor requests</p>
            <p className="text-xs text-zinc-500 mt-2">
              Users can request APIs to be watched via Settings → Request an API
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {requestsWithEmails.map((request) => (
            <div key={request.id} className="group">
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(15,23,42,0.05))] pointer-events-none" />
                <div className="relative z-10">
                  <div className="mb-4 p-4 bg-zinc-900/50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-zinc-100">{request.vendor_name}</h2>
                        <p className="mt-1 text-sm text-zinc-500 truncate max-w-[300px]">
                          {request.spec_or_docs_url || "No spec URL provided"}
                        </p>
                        {request.note && (
                          <p className="mt-2 text-xs text-zinc-400">{request.note}</p>
                        )}
                        <div className="mt-3 flex flex-col gap-2 text-xs text-zinc-500">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-zinc-400 mr-1" />
                            <span>
                              Requested by <span className="font-medium">{request.user_email || "Unknown user"}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-zinc-400 mr-1" />
                            <span>
                              {new Date(request.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <form action={approveAction}>
                          <input type="hidden" name="requestId" value={request.id} />
                          <Button
                            variant="default"
                            size="sm"
                            type="submit"
                            className="px-4 py-2 text-xs font-medium transition-all duration-200 hover:bg-orange-500 hover:text-zinc-950"
                          >
                            Approve
                          </Button>
                        </form>
                        <form action={rejectAction}>
                          <input type="hidden" name="requestId" value={request.id} />
                          <Button
                            variant="destructive"
                            size="sm"
                            type="submit"
                            className="px-4 py-2 text-xs font-medium transition-all duration-200 hover:bg-red-500 hover:text-zinc-950"
                          >
                            Reject
                          </Button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}