import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard, Boxes, Settings } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/apis", label: "My APIs", icon: Boxes },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-zinc-800 bg-zinc-950 md:flex md:flex-col">
        <div className="flex h-14 items-center border-b border-zinc-800 px-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Spec<span className="text-orange-500">Watch</span>
          </Link>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((item) => (
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
            {NAV.map((item) => (
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
