import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SHUNYA — your study, in focus",
  description: "A calmer, smarter workspace for JEE and NEET preparation."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
