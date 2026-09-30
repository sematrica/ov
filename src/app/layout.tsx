import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Nearby — Orbital Observatory",
  description:
    "Discover near-Earth objects with NASA NeoWs and explore their motion with authoritative JPL Horizons trajectories.",
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
