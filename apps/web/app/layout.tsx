import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "../lib/auth-context";
import { PwaRegistration } from "../components/pwa-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "IOCL Truck Management",
  description: "Indian Oil Truck Management for secure IN, OUT and administrative terminal operations",
  manifest: "/manifest.webmanifest",
  applicationName: "IOCL Truck Management",
  appleWebApp: { capable: true, title: "IOCL Truck Management", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icon-192.png" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0B1B4D",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <PwaRegistration />
        <Toaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}
