"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  Sparkles,
  ClipboardList,
  LogOut,
  Camera,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brands", label: "Marques", icon: Building2 },
  { href: "/generate", label: "Générer", icon: Sparkles },
  { href: "/jobs", label: "Historique", icon: ClipboardList },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col border-r border-border bg-card h-screen">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold/20 border border-gold/30 flex items-center justify-center">
            <Camera className="w-4 h-4 text-gold" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Booth Dashboard</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Photo Paris</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150",
                active
                  ? "bg-gold/15 text-gold font-medium border border-gold/20"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-red-400 transition-all duration-150"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
