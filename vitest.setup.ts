import "@testing-library/jest-dom";
import { vi, beforeAll, afterAll } from "vitest";
import React from "react";

// Mock Next.js modules
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

// Mock Clerk
vi.mock("@clerk/nextjs", () => ({
  SignIn: vi.fn(({ children, ...props }) => React.createElement("div", { "data-testid": "clerk-sign-in", ...props }, children)),
  SignUp: vi.fn(({ children, ...props }) => React.createElement("div", { "data-testid": "clerk-sign-up", ...props }, children)),
  ClerkProvider: vi.fn(({ children }) => React.createElement("div", { "data-testid": "clerk-provider" }, children)),
  useUser: vi.fn(() => ({ isLoaded: true, isSignedIn: false, user: null })),
  useAuth: vi.fn(() => ({ isLoaded: true, isSignedIn: false, userId: null, getToken: vi.fn() })),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: null, orgId: null, sessionId: null, getToken: vi.fn() })),
  currentUser: vi.fn(() => Promise.resolve(null)),
  clerkClient: vi.fn(() => Promise.resolve({
    users: { getUser: vi.fn() },
    organizations: { getOrganization: vi.fn() },
  })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
    })),
    rpc: vi.fn(),
    auth: {
      admin: {
        getUserById: vi.fn(),
      },
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        download: vi.fn(),
      })),
    },
  })),
}));

// Mock environment variables
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_mock";
process.env.CLERK_SECRET_KEY = "sk_test_mock";
process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.CRON_SECRET = "test-cron-secret";
process.env.APP_URL = "http://localhost:3000";
process.env.POLAR_PRODUCT_PRO_MONTHLY = "pro-monthly";
process.env.POLAR_PRODUCT_TEAM_MONTHLY = "team-monthly";
process.env.RESEND_API_KEY = "re_test_mock";
process.env.POLAR_ACCESS_TOKEN = "polar_test_mock";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.ADMIN_USER_IDS = "test-admin-id";

// Suppress console.error in tests unless explicitly testing errors
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (args[0]?.includes?.("Warning: ReactDOM.render is no longer supported")) return;
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});