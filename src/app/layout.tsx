import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Eleza · Defend the argument", description: "An essay can't tell you what a student understands. A conversation can." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
