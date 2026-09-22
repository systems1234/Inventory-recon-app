import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getBigQuery, table } from "./bigquery";
import type { AppUser } from "./types";

async function queryUser(email: string): Promise<AppUser | null> {
  const bq = getBigQuery();
  const query = `
    SELECT user_id, name, role, active
    FROM ${table("users")}
    WHERE user_id = @email AND active = TRUE
    LIMIT 1
  `;
  const [rows] = await bq.query({ query, params: { email } });
  if (!rows.length) return null;
  return rows[0] as AppUser;
}

/**
 * A cold serverless function can hit a transient BigQuery auth/connection
 * hiccup on its very first query, which would otherwise surface to the user
 * as "this account isn't registered" (indistinguishable from a real
 * rejection) even though a retry a second later succeeds. One retry here
 * absorbs that instead of failing sign-in on it.
 */
async function lookupUser(email: string): Promise<AppUser | null> {
  try {
    return await queryUser(email);
  } catch (err) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return await queryUser(email);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    })
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  callbacks: {
    // Reject anyone whose email isn't an active row in `users`.
    async signIn({ user }) {
      if (!user.email) return false;
      const appUser = await lookupUser(user.email);
      return appUser !== null;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const appUser = await lookupUser(user.email);
        if (appUser) {
          token.role = appUser.role;
          token.name = appUser.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    }
  }
};
