import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard, Boxes, Settings } from "lucide-react";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();

  // Define base navigation items
  const baseNav = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/apis", label: "My APIs", icon: Boxes },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ];

  // Admin navigation items (only shown to admins)
  const adminNav = [
    { href: "/dashboard/admin", label: "Vendor Requests", icon: LayoutDashboard },
  ];

  // Check if user is admin (simplified approach - in production, use proper role checking)
  const isAdmin = userId && process.env.ADMIN_USER_IDS?.includes(userId);

  // Combine nav items
  const navItems = isAdmin ? [...baseNav, ...adminNav] : baseNav;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-zinc-800 bg-zinc-950 md:flex md:flex-col">
        <div className="flex h-14 items-center border-b border-zinc-800 px-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Spec<span className="text-orange-500">Watch</span>
          </Link>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-3">
          <UserButton />
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <div className="flex h-14 items-center gap-3 border-b border-zinc-800 px-4 md:hidden">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Spec<span className="text-orange-500">Watch</span>
          </Link>
          <nav className="ml-auto flex gap-3 text-sm text-zinc-400">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mx-auto w-full max-w-4xl p-6">{children}</div>
      </main>
    </div>
  );
}
