import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

// Self-hosted Geist (via the `geist` package): the build never depends on
// fetching fonts from Google at build time, and pages ship no font-CDN request.
const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "SpecWatch — know before it breaks",
    template: "%s — SpecWatch",
  },
  description:
    "We watch the public API specs of Stripe, GitHub, OpenAI and more, and warn you in plain English when a vendor's change will break your code.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
