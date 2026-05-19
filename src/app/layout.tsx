import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoleRoadmap",
  description:
    "Turn a job role into a visual, interactive knowledge graph with theory, practice, and spaced repetition.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
