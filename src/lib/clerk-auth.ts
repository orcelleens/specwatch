import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";

export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

export async function getUser() {
  const user = await currentUser();
  if (!user) return null;

  return {
    id: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? null,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
    publicMetadata: user.publicMetadata,
    unsafeMetadata: user.unsafeMetadata,
  };
}

export async function isAdmin(userId: string): Promise<boolean> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const adminIds = process.env.ADMIN_USER_IDS?.split(",") ?? [];
  return adminIds.includes(userId);
}

export async function signOut() {
  const { sessionId } = await auth();
  if (sessionId) {
    const client = await clerkClient();
    await client.sessions.revokeSession(sessionId);
  }
}