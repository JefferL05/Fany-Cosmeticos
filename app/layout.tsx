import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fany Cosméticos | Beleza coreana que acolhe você",
  description:
    "Skincare e cosméticos coreanos selecionados para transformar sua rotina de autocuidado.",
  keywords: ["cosméticos coreanos", "k-beauty", "skincare", "beleza coreana"],
  openGraph: {
    title: "Fany Cosméticos",
    description: "Rituais de beleza que acolhem você.",
    type: "website",
    locale: "pt_BR"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
