import Link from "next/link";
import { getUser } from "@/lib/supabase-server";
import { signOutAction } from "@/app/dashboard/actions";
import { LayoutDashboard, Boxes, Settings, Activity, LogOut } from "lucide-react";

const ADMIN_NAV = [
  { href: "/dashboard/admin", label: "Vendor Requests", icon: LayoutDashboard },
  { href: "/dashboard/admin/vendors", label: "All Vendors", icon: Boxes },
  { href: "/dashboard/admin/activity", label: "Activity", icon: Activity },
  { href: "/dashboard/admin/settings", label: "Settings", icon: Settings },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-zinc-800 bg-zinc-950 md:flex md:flex-col">
        <div className="flex h-16 items-center border-b border-zinc-800 px-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Spec<span className="text-orange-500">Watch</span>
          </Link>
        </div>
        <nav className="flex flex-col gap-2 p-4">
          {ADMIN_NAV.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium text-zinc-400 transition-all duration-200 hover:bg-zinc-900 hover:text-zinc-100 ${
                index === 0 ? "border-l-4 border-orange-500 bg-zinc-900/20" : ""
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-4">
          {user ? (
            <form action={signOutAction}>
              <button
                type="submit"
                className="w-full flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium text-zinc-400 transition-all duration-200 hover:bg-zinc-900 hover:text-zinc-100"
              >
                <LogOut size={20} />
                <span>Sign out</span>
              </button>
            </form>
          ) : null}
          <div className="mt-4 text-xs text-zinc-500">
            Admin Panel
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <div className="flex h-16 items-center gap-4 border-b border-zinc-800 px-4 md:hidden">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Spec<span className="text-orange-500">Watch</span>
          </Link>
          <nav className="ml-auto flex gap-4 text-base text-zinc-400">
            {ADMIN_NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mx-auto w-full max-w-5xl p-6">{children}</div>
      </main>
    </div>
  );
}