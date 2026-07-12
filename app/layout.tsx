import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elite-Elator",
  description: "Private, real-time messaging",
  manifest: "/manifest.json",
  themeColor: "#075E54",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}