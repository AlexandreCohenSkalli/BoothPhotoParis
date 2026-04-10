"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  Sparkles,
  ClipboardList,
  LogOut,
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
      <div className="px-5 py-5 border-b border-border">
        <Link href="/" className="flex items-end gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://cdn.prod.website-files.com/6895d87ce77db277b0f232d0/6895db410c1b084e5c21e7a2_photoboothparis-logo-p-500.webp"
            alt="Booth Photo Paris"
            className="h-9 w-auto object-contain"
          />
          <span className="text-[10px] text-muted-foreground/60 pb-0.5 leading-none">
            by Gavroch.Dev
          </span>
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 border border-gold/30 text-[10px] font-semibold text-gold tracking-wider">
            ✦ IA.Agent
          </span>
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

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-red-400 transition-all duration-150"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Déconnexion
        </button>
        <p className="text-[10px] text-muted-foreground/40 px-3 pt-1">
          developed by{" "}
          <a href="https://gavroch.dev" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">
            Gavroch.dev
          </a>
        </p>
      </div>
    </aside>
  )
}
