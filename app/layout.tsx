import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OrderFlow · Studio order management",
  description: "A focused order-management dashboard for small creative teams.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
