import type { Metadata } from "next"
import { GeistMono } from "geist/font/mono"

import "./globals.css"

export const metadata: Metadata = {
  title: "Sub2API Status Dashboard",
  description: "Minimal status dashboard for Sub2API",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${GeistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-black font-mono text-white">{children}</body>
    </html>
  )
}
