"use client";

import { SignIn } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-full max-w-md px-4">
        <div className="bg-zinc-900 border border-zinc-800 shadow-xl rounded-2xl p-8">
          <div className="mb-8">
            <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6">
              <ArrowLeft className="h-5 w-5" />
              Back
            </Link>
            <h1 className="text-2xl font-bold text-zinc-100">Sign in to SpecWatch</h1>
            <p className="mt-2 text-zinc-400">Enter your email to continue</p>
          </div>

          <SignIn
            appearance={{
              elements: {
                formButtonPrimary: "bg-orange-500 hover:bg-orange-600 text-zinc-950 font-medium",
                card: "bg-transparent shadow-none border-none",
                headerTitle: "text-zinc-100",
                headerSubtitle: "text-zinc-400",
                socialButtonsBlockButton: "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-100",
                socialButtonsBlockButtonIcon: "text-zinc-400",
                socialButtonsBlockButtonText: "text-zinc-100",
              },
            }}
            routing="path"
            path="/sign-in"
          />
        </div>
      </div>
    </div>
  );
}