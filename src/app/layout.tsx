import type { Metadata } from "next";
import { Suspense } from "react";
import AccountChip from "@/components/AccountChip";
import "./globals.css";

export const metadata: Metadata = {
  title: "לימוד שפות",
  description: "Vocabulary Flashcards",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <AccountChip />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
