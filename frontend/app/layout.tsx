import type { Metadata } from "next";
import { product } from "@/lib/config";
import "./globals.css";
export const metadata: Metadata = {
  title: `${product.name} — Project discovery`,
  description:
    "Turn a rough software idea into a clear, practical project brief with Zevron Studio.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
