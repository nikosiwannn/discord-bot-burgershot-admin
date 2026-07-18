import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "🍔 BurgerShot Manager Bot — Panel Administracyjny",
  description: "Panel administracyjny Discord Bota Burger Shot HR",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}
