import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { employeeTable, getBigQuery, table } from "./bigquery";

/** The value this app's rows carry in Employee_Data.Project_Systems. */
const PROJECT_SYSTEM = "inventory_recon";

interface EmployeeRecord {
  name: string;
}

interface AppUser {
  name: string;
  role: "member" | "admin";
}

/**
 * Sign-in access now comes from HR's own employee directory
 * (LifeCycle_FMS.Employee_Data) instead of a separate allow-list this app
 * owns: a Google account may sign in only if it has a row there whose
 * Project_Systems column lists "inventory_recon" (a comma-separated list on
 * that column, so this splits rather than doing a flat equality check).
 */
async function queryEmployee(email: string): Promise<EmployeeRecord | null> {
  const bq = getBigQuery();
  const query = `
    SELECT Employee_Name AS name
    FROM ${employeeTable()}
    WHERE LOWER(Email_ID) = LOWER(@email)
      AND EXISTS (
        SELECT 1 FROM UNNEST(SPLIT(Project_Systems, ',')) AS system
        WHERE LOWER(TRIM(system)) = @projectSystem
      )
    LIMIT 1
  `;
  const [rows] = await bq.query({ query, params: { email, projectSystem: PROJECT_SYSTEM } });
  if (!rows.length) return null;
  return { name: rows[0].name };
}

/**
 * Admin status is still tracked in this app's own `users` table (Employee_Data
 * has no such concept) -- anyone not listed there, or not marked admin, is a
 * plain member.
 */
async function queryRole(email: string): Promise<"member" | "admin"> {
  const bq = getBigQuery();
  const query = `
    SELECT role FROM ${table("users")}
    WHERE LOWER(user_id) = LOWER(@email) AND active = TRUE
    LIMIT 1
  `;
  const [rows] = await bq.query({ query, params: { email } });
  if (!rows.length) return "member";
  return rows[0].role === "admin" ? "admin" : "member";
}

async function queryAppUser(email: string): Promise<AppUser | null> {
  const employee = await queryEmployee(email);
  if (!employee) return null;
  const role = await queryRole(email);
  return { name: employee.name, role };
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
    return await queryAppUser(email);
  } catch (err) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return await queryAppUser(email);
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
    // Reject anyone without a matching, in-scope row in Employee_Data.
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
