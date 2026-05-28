import { getToken } from '@auth/core/jwt';
import { getContext } from 'hono/context-storage';

export default function CreateAuth() {
	const auth = async () => {
		const c = getContext();
		const token = await getToken({
			req: c.req.raw,
			secret: process.env.AUTH_SECRET,
			cookieName: 'authjs.session-token',
		});
		if (token) {
			const userId = token.id || token.sub;
			if (!userId) return null;
			return {
				user: {
					id: userId,
					email: token.email,
					name: token.name,
					image: token.picture,
					role: token.role,
					status: token.status,
				},
				expires: token.exp ? new Date(token.exp * 1000).toISOString() : '',
			};
		}
		return null;
	};
	return {
		auth,
	};
}
