import type { Metadata, Viewport } from "next";
import { Inter, Cairo } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const cairo = Cairo({ variable: "--font-cairo", subsets: ["arabic", "latin"] });

export const metadata: Metadata = {
  title: "AI Lead Finder — local leads, website audits & AI outreach",
  description: "Find local businesses, audit their websites and get a personalized AI outreach email for each lead. Export to Excel.",
};
export const viewport: Viewport = { themeColor: "#070816" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${cairo.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
