import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Nearby — Orbital Observatory",
  description:
    "Explore Earth and Apophis through time with real heliocentric NASA/JPL Horizons trajectories.",
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
