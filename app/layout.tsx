import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host") ?? "localhost:3000";
  const protocol = incomingHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const configuredOrigin = String(process.env.SITE_PUBLIC_ORIGIN ?? "").trim();
  const baseUrl = configuredOrigin ? new URL(configuredOrigin).origin : `${protocol}://${host}`;
  const title = "Pata Papaya — Juguetes tropicales para patas felices";
  const description = "Juguetes tropicales para perros y gatos con muchas ganas de jugar.";

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: baseUrl,
      images: [{ url: `${baseUrl}/og-pata-papaya.png`, width: 1736, height: 909, alt: "Pata Papaya — Juguetes tropicales para patas felices" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${baseUrl}/og-pata-papaya.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
