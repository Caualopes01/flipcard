import "./globals.css";

export const metadata = {
  title: "CardFlip — Caça-Oportunidades de Cartas",
  description: "Encontre as melhores oportunidades de compra de cartas colecionáveis no Brasil",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
