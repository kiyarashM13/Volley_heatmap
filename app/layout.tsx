import type { Metadata } from "next"
import { Vazirmatn } from "next/font/google"

import "./globals.css"

const vazir = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazir",
})

export const metadata: Metadata = {
  title: "جهت حمله",
  description: "نقشه حرارتی و مسیر حمله والیبال از فایل اسکاوت DataVolley",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl" className={`${vazir.variable} dark h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">{children}</body>
    </html>
  )
}
