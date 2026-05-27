import type {
	AdapterUser,
	VerificationToken,
	Adapter,
	AdapterSession,
} from '@auth/core/adapters';
import type { ProviderType } from '@auth/core/providers';
import type { Sql } from 'postgres';

interface NeonUser extends AdapterUser {
	role?: string;
	is_active?: boolean;
	status?: string;
	accounts: {
		provider: string;
		provider_account_id: string;
		password?: string;
	}[];
}

interface NeonAdapter extends Adapter {
	createUser(data: AdapterUser): Promise<AdapterUser>;
	getUser(userId: string): Promise<AdapterUser | null>;
	getUserByEmail(email: string): Promise<NeonUser | null>;
	getUserByAccount(data: {
		provider: string;
		providerAccountId: string;
	}): Promise<AdapterUser | null>;
	linkAccount(data: {
		userId: string;
		provider: string;
		providerAccountId: string;
		type: ProviderType;
		access_token?: string | null;
		expires_at?: number | null;
		refresh_token?: string | null;
		id_token?: string | null;
		scope?: string | null;
		session_state?: string | null;
		token_type?: string | null;
		extraData?: Record<string, unknown>;
	}): Promise<void>;
}

export default function NeonAdapter(sql: Sql): NeonAdapter {
	return {
		async createVerificationToken(
			verificationToken: VerificationToken
		): Promise<VerificationToken> {
			const { identifier, expires, token } = verificationToken;
			await sql`
				INSERT INTO auth_verification_token (identifier, expires, token)
				VALUES (${identifier}, ${expires}, ${token})
			`;
			return verificationToken;
		},
		async useVerificationToken({
			identifier,
			token,
		}: {
			identifier: string;
			token: string;
		}): Promise<VerificationToken | null> {
			const result = await sql`
				DELETE FROM auth_verification_token
				WHERE identifier = ${identifier} AND token = ${token}
				RETURNING identifier, expires, token
			`;
			return result.length > 0 ? (result[0] as VerificationToken) : null;
		},

		async createUser(user: Omit<AdapterUser, 'id'>) {
			const { name, email, emailVerified, image } = user;
			const result = await sql`
				INSERT INTO auth_users (name, email, "emailVerified", image)
				VALUES (${name}, ${email}, ${emailVerified}, ${image})
				RETURNING id, name, email, "emailVerified", image
			`;
			return result[0] as AdapterUser;
		},
		async getUser(id: string) {
			try {
				const result = await sql`SELECT * FROM auth_users WHERE id = ${id}`;
				return result.length === 0 ? null : (result[0] as AdapterUser);
			} catch {
				return null;
			}
		},
		async getUserByEmail(email: string): Promise<NeonUser | null> {
			const result = await sql`SELECT * FROM auth_users WHERE email = ${email}`;
			if (result.length === 0) {
				return null;
			}
			const userData = result[0];
			const accountsData = await sql`
				SELECT * FROM auth_accounts WHERE "userId" = ${userData.id}
			`;
			return {
				id: userData.id,
				name: userData.name,
				email: userData.email,
				emailVerified: userData.emailVerified,
				image: userData.image,
				role: userData.role,
				is_active: userData.is_active,
				status: userData.status,
				accounts: accountsData.map((row) => ({
					provider: row.provider,
					provider_account_id: row.providerAccountId,
					password: row.password,
				})),
			} as unknown as NeonUser;
		},
		async getUserByAccount({
			providerAccountId,
			provider,
		}): Promise<AdapterUser | null> {
			const result = await sql`
				SELECT u.* FROM auth_users u
				JOIN auth_accounts a ON u.id = a."userId"
				WHERE a.provider = ${provider}
				AND a."providerAccountId" = ${providerAccountId}
			`;
			return result.length > 0 ? (result[0] as AdapterUser) : null;
		},
		async updateUser(user: Partial<AdapterUser>): Promise<AdapterUser> {
			const query1 = await sql`SELECT * FROM auth_users WHERE id = ${user.id}`;
			const oldUser = query1[0];

			const newUser = {
				...oldUser,
				...user,
			};

			const { id, name, email, emailVerified, image } = newUser;
			const query2 = await sql`
				UPDATE auth_users SET
				name = ${name}, email = ${email}, "emailVerified" = ${emailVerified}, image = ${image}
				WHERE id = ${id}
				RETURNING name, id, email, "emailVerified", image
			`;
			return query2[0] as AdapterUser;
		},
		async linkAccount(account) {
			const result = await sql`
				INSERT INTO auth_accounts
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
				VALUES (
					${account.userId},
					${account.provider},
					${account.type},
					${account.providerAccountId},
					${account.access_token ?? null},
					${account.expires_at ?? null},
					${account.refresh_token ?? null},
					${account.id_token ?? null},
					${account.scope ?? null},
					${account.session_state ?? null},
					${account.token_type ?? null},
					${(account.extraData?.password as string) ?? null}
				)
				RETURNING
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
			return result[0] as any;
		},
		async createSession({ sessionToken, userId, expires }) {
			if (userId === undefined) {
				throw Error('userId is undef in createSession');
			}
			const result = await sql`
				INSERT INTO auth_sessions ("userId", expires, "sessionToken")
				VALUES (${userId}, ${expires}, ${sessionToken})
				RETURNING id, "sessionToken", "userId", expires
			`;
			return result[0] as AdapterSession;
		},

		async getSessionAndUser(sessionToken: string | undefined): Promise<{
			session: AdapterSession;
			user: AdapterUser;
		} | null> {
			if (sessionToken === undefined) {
				return null;
			}
			const result1 = await sql`
				SELECT * FROM auth_sessions WHERE "sessionToken" = ${sessionToken}
			`;
			if (result1.length === 0) {
				return null;
			}
			const session = result1[0] as AdapterSession;

			const result2 = await sql`
				SELECT * FROM auth_users WHERE id = ${session.userId}
			`;
			if (result2.length === 0) {
				return null;
			}
			const user = result2[0] as AdapterUser;
			return {
				session,
				user,
			};
		},
		async updateSession(
			session: Partial<AdapterSession> & Pick<AdapterSession, 'sessionToken'>
		): Promise<AdapterSession | null | undefined> {
			const { sessionToken } = session;
			const result1 = await sql`
				SELECT * FROM auth_sessions WHERE "sessionToken" = ${sessionToken}
			`;
			if (result1.length === 0) {
				return null;
			}
			const originalSession = result1[0] as AdapterSession;

			const newSession: AdapterSession = {
				...originalSession,
				...session,
			};
			const result = await sql`
				UPDATE auth_sessions SET
				expires = ${newSession.expires}
				WHERE "sessionToken" = ${newSession.sessionToken}
			`;
			return result[0] as AdapterSession;
		},
		async deleteSession(sessionToken) {
			await sql`DELETE FROM auth_sessions WHERE "sessionToken" = ${sessionToken}`;
		},
		async unlinkAccount(partialAccount) {
			const { provider, providerAccountId } = partialAccount;
			await sql`
				DELETE FROM auth_accounts
				WHERE "providerAccountId" = ${providerAccountId} AND provider = ${provider}
			`;
		},
		async deleteUser(userId: string) {
			await sql`DELETE FROM auth_users WHERE id = ${userId}`;
			await sql`DELETE FROM auth_sessions WHERE "userId" = ${userId}`;
			await sql`DELETE FROM auth_accounts WHERE "userId" = ${userId}`;
		},
	};
}
