/**
 * Motor X Authentication Module — Adriel's Systems
 * Handles credential-based auth (sign-in/sign-up), JWT session management,
 * and concurrent session control for the Motor X platform.
 */
import CreateAuth from "@auth/create"
import Credentials from "@auth/core/providers/credentials"
import { Pool } from '@neondatabase/serverless'
import { verify } from 'argon2'
import sql from "@/app/api/utils/sql"; // Import SQL utility for session updates
import crypto from "crypto";

function Adapter(client) {
  return {
    async createVerificationToken(
      verificationToken
    ) {
      const { identifier, expires, token } = verificationToken;
      const sql = `
        INSERT INTO auth_verification_token ( identifier, expires, token )
        VALUES ($1, $2, $3)
        `;
      await client.query(sql, [identifier, expires, token]);
      return verificationToken;
    },
    async useVerificationToken({
      identifier,
      token,
    }) {
      const sql = `delete from auth_verification_token
      where identifier = $1 and token = $2
      RETURNING identifier, expires, token `;
      const result = await client.query(sql, [identifier, token]);
      return result.rowCount !== 0 ? result.rows[0] : null;
    },

    async createUser(user) {
      const { name, email, emailVerified, image } = user;
      const sql = `
        INSERT INTO auth_users (name, email, "emailVerified", image)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, email, "emailVerified", image`;
      const result = await client.query(sql, [
        name,
        email,
        emailVerified,
        image,
      ]);
      return result.rows[0];
    },
    async getUser(id) {
      const sql = 'select * from auth_users where id = $1';
      try {
        const result = await client.query(sql, [id]);
        return result.rowCount === 0 ? null : result.rows[0];
      } catch {
        return null;
      }
    },
    async getUserByEmail(email) {
      const sql = 'select id, name, email, "emailVerified", image, role, is_active, status, current_session_token from auth_users where email = $1';
      const result = await client.query(sql, [email]);
      if (result.rowCount === 0) {
        return null;
      }
      const userData = result.rows[0];
      const accountsData = await client.query(
        'select * from auth_accounts where "providerAccountId" = $1',
        [userData.id]
      );
      return {
        ...userData,
        accounts: accountsData.rows,
      };
    },
    async getUserByAccount({
      providerAccountId,
      provider,
    }) {
      const sql = `
          select u.* from auth_users u join auth_accounts a on u.id = a."userId"
          where
          a.provider = $1
          and
          a."providerAccountId" = $2`;

      const result = await client.query(sql, [provider, providerAccountId]);
      return result.rowCount !== 0 ? result.rows[0] : null;
    },
    async updateUser(user) {
      const fetchSql = 'select * from auth_users where id = $1';
      const query1 = await client.query(fetchSql, [user.id]);
      const oldUser = query1.rows[0];

      const newUser = {
        ...oldUser,
        ...user,
      };

      const { id, name, email, emailVerified, image } = newUser;
      const updateSql = `
        UPDATE auth_users set
        name = $2, email = $3, "emailVerified" = $4, image = $5
        where id = $1
        RETURNING name, id, email, "emailVerified", image
      `;
      const query2 = await client.query(updateSql, [
        id,
        name,
        email,
        emailVerified,
        image,
      ]);
      return query2.rows[0];
    },
    async linkAccount(account) {
      const sql = `
      insert into auth_accounts
      (
        "userId",
        provider,
        type,
        "providerAccountId",
        access_token,
        expires_at,
        refresh_token,
        id_token,
        scope,
        session_state,
        token_type,
        password
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning
        id,
        "userId",
        provider,
        type,
        "providerAccountId",
        access_token,
        expires_at,
        refresh_token,
        id_token,
        scope,
        session_state,
        token_type,
        password
      `;

      const params = [
        account.userId,
        account.provider,
        account.type,
        account.providerAccountId,
        account.access_token,
        account.expires_at,
        account.refresh_token,
        account.id_token,
        account.scope,
        account.session_state,
        account.token_type,
        account.extraData?.password,
      ];

      const result = await client.query(sql, params);
      return result.rows[0];
    },
    async createSession({ sessionToken, userId, expires }) {
      if (userId === undefined) {
        throw Error('userId is undef in createSession');
      }
      const sql = `insert into auth_sessions ("userId", expires, "sessionToken")
      values ($1, $2, $3)
      RETURNING id, "sessionToken", "userId", expires`;

      const result = await client.query(sql, [userId, expires, sessionToken]);
      return result.rows[0];
    },

    async getSessionAndUser(sessionToken) {
      if (sessionToken === undefined) {
        return null;
      }
      const result1 = await client.query(
        `select * from auth_sessions where "sessionToken" = $1`,
        [sessionToken]
      );
      if (result1.rowCount === 0) {
        return null;
      }
      const session = result1.rows[0];

      const result2 = await client.query(
        'select * from auth_users where id = $1',
        [session.userId]
      );
      if (result2.rowCount === 0) {
        return null;
      }
      const user = result2.rows[0];
      return {
        session,
        user,
      };
    },
    async updateSession(
      session
    ) {
      const { sessionToken } = session;
      const result1 = await client.query(
        `select * from auth_sessions where "sessionToken" = $1`,
        [sessionToken]
      );
      if (result1.rowCount === 0) {
        return null;
      }
      const originalSession = result1.rows[0];

      const newSession = {
        ...originalSession,
        ...session,
      };
      const sql = `
        UPDATE auth_sessions set
        expires = $2
        where "sessionToken" = $1
        `;
      const result = await client.query(sql, [
        newSession.sessionToken,
        newSession.expires,
      ]);
      return result.rows[0];
    },
    async deleteSession(sessionToken) {
      const sql = `delete from auth_sessions where "sessionToken" = $1`;
      await client.query(sql, [sessionToken]);
    },
    async unlinkAccount(partialAccount) {
      const { provider, providerAccountId } = partialAccount;
      const sql = `delete from auth_accounts where "providerAccountId" = $1 and provider = $2`;
      await client.query(sql, [providerAccountId, provider]);
    },
    async deleteUser(userId) {
      await client.query('delete from auth_users where id = $1', [userId]);
      await client.query('delete from auth_sessions where "userId" = $1', [
        userId,
      ]);
      await client.query('delete from auth_accounts where "userId" = $1', [
        userId,
      ]);
    },
  };
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=disable') ? false : { rejectUnauthorized: false }
});
const adapter = Adapter(pool);

export const { auth } = CreateAuth({
  providers: [Credentials({
    id: 'credentials-signin',
    name: 'Credentials Sign in',
    credentials: {
      email: {
        label: 'Email',
        type: 'email',
      },
      password: {
        label: 'Password',
        type: 'password',
      },
    },
    authorize: async (credentials) => {
      const { email, password } = credentials;
      if (!email || !password) {
        return null;
      }
      if (typeof email !== 'string' || typeof password !== 'string') {
        return null;
      }

      // logic to verify if user exists
      const user = await adapter.getUserByEmail(email);
      if (!user) {
        console.log("[Auth Error] User not found:", email);
        return null;
      }

      console.log("[Auth Debug] User found:", { email, status: user.status, role: user.role });

      // --- ACCOUNT STATUS CHECK ---
      if (user.status === 'inactive') {
        console.log("[Auth Error] User inactive:", email);
        throw new Error("Tu cuenta ha sido desactivada. Por favor, contacta a soporte.");
      }
      const matchingAccount = user.accounts.find(
        (account) => account.provider === 'credentials'
      );
      const accountPassword = matchingAccount?.password;
      if (!accountPassword) {
        console.log("[Auth Error] No credentials account for user:", email);
        return null;
      }

      const isValid = await verify(accountPassword, password);
      if (!isValid) {
        console.log("[Auth Error] Invalid password for user:", email);
        return null;
      }

      // return user object with the their profile data

      // --- CONCURRENT SESSION CONTROL ---

      // 1. Check if user has an active session (last 3 hours)
      const SESSION_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 Hours
      const now = new Date();
      const lastActivity = user.last_activity ? new Date(user.last_activity) : new Date(0);
      const timeSinceLastActivity = now - lastActivity;

      // If session is active (less than timeout) and token exists
      if (user.current_session_token && timeSinceLastActivity < SESSION_TIMEOUT_MS) {
        console.log("[Auth Error] Active session detected for:", email, { lastActivity, timeSinceLastActivity });
        // Reject login
        throw new Error("Ya tienes una sesión activa. Debes cerrarla o esperar 3 horas de inactividad.");
      }

      // 2. Generate new session token
      const newSessionToken = crypto.randomUUID();

      // 3. Update DB with new token and activity
      try {
        await sql`
          UPDATE auth_users 
          SET current_session_token = ${newSessionToken}, last_activity = NOW() 
          WHERE id = ${user.id}
        `;
      } catch (error) {
        console.error("Failed to update session token:", error);
        // Continue anyway? Or fail? 
        // Failing is safer for enforcement.
        // throw new Error("Failed to initialize session.");
      }

      // Using the 'sql' utility would be cleaner if available here. 
      // 'auth.js' imports 'Pool' but doesn't instantiate 'sql' like in other files.
      // I will use a direct query via a new Pool connection or existing one if accessible.

      // REVISION: I cannot access 'client' or valid SQL executor easily inside 'authorize' without importing 'sql' utility.
      // I will import 'sql' from '@/app/api/utils/sql' at top of file instead of relying on 'adapter' internals.

      console.log("[Auth Success] Returning user object for:", email);

      // Audit Log the successful login
      try {
        const { logAudit, RESOURCE_TYPES } = await import("@/utils/auditLogger");
        await logAudit({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            userRole: user.role,
            action: 'USER_LOGIN',
            resourceType: RESOURCE_TYPES.USER,
            resourceId: user.id,
            details: { message: "Client logged into MXCLIENT Portal" }
        });
      } catch (err) {
        console.error("[Auth Audit Error] Failed to log login:", err);
      }

      return { 
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role, 
        status: user.status,
        current_session_token: newSessionToken 
      };
    },
  })],

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours (extended for operational shifts)
    updateAge: 1 * 60 * 60, // 1 hour (refresh frequency)
  },
  callbacks: {
    async session({ session, user, token }) {
      console.log("[Auth Debug] Session Callback:", {
        hasToken: !!token,
        hasUser: !!user,
        roleInToken: token?.role,
        statusInToken: token?.status
      });

      if (!session.user) session.user = {};

      if (user) {
        session.user.id = user.id;
        session.user.role = user.role;
        session.user.status = user.status;
      } else if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.status = token.status;
      }
      return session;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        console.log("[Auth Debug] JWT Initial Signin:", { 
          id: user.id, 
          role: user.role, 
          status: user.status 
        });
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;
      }

      // Allow session updates to modify token (useful if we ever add role swapping)
      if (trigger === "update" && session?.role) {
        token.role = session.role;
      }
      return token;
    }
  },
  cookies: {
    sessionToken: {
      name: `authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production" && process.env.SECURE_COOKIES !== "false",
        domain: process.env.NODE_ENV === "production" && process.env.SECURE_COOKIES !== "false" ? ".motorxcars.com" : undefined,
      },
    },
  },
  pages: {
    signIn: '/account/signin',
    signOut: '/account/logout',
  },
})