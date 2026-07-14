import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Eleza · Claim graph", description: "Inspect an argument before its oral defense." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
