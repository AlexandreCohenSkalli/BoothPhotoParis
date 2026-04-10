import type { Metadata } from "next"
import { Inter, Playfair_Display } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import Sidebar from "@/components/layout/Sidebar"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
})

export const metadata: Metadata = {
  title: "Booth Dashboard — Brand Generator",
  description: "Générateur de présentations et visuels IA pour Booth Photo Paris",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className="dark">
      <body className={`${inter.variable} ${playfair.variable} font-sans`}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="container mx-auto px-6 py-8">
              {children}
            </div>
          </main>
        </div>
        <Toaster />
      </body>
    </html>
  )
}
