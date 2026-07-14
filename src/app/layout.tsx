import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Eleza · Defend the argument", description: "A transparent AI oral defense with receipts instead of verdicts." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
