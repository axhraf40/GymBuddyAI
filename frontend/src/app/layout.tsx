import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GymBuddy AI — Your Training & Nutrition, Explained",
  description:
    "AI gym & nutrition coach chatbot with an interactive anatomical muscle map, personalized macro targets, animated exercise guides, and equipment photo recognition.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={bricolage.variable}>
      <body className="min-h-screen bg-bg text-ink antialiased selection:bg-lime/60 selection:text-forest-deep">
        {children}
      </body>
    </html>
  );
}
