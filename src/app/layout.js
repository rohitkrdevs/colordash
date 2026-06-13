import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  weight: ["400", "600", "800"],
  subsets: ["latin"],
  variable: "--font-family",
});

export const metadata = {
  title: "Color Dash Runner",
  description: "A fun, colorful, responsive infinite runner game.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${poppins.variable}`}>
      <body>{children}</body>
    </html>
  );
}
