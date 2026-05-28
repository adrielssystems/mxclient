import { getToken } from '@auth/core/jwt';
export async function GET(request) {
	const [token, jwt] = await Promise.all([
		getToken({
			req: request,
			secret: process.env.AUTH_SECRET,
			cookieName: 'authjs.session-token',
			raw: true,
		}),
		getToken({
			req: request,
			secret: process.env.AUTH_SECRET,
			cookieName: 'authjs.session-token',
		}),
	]);

	if (!jwt) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: {
				'Content-Type': 'application/json',
			},
		});
	}

	const userId = jwt.id || jwt.sub;

	return new Response(
		JSON.stringify({
			jwt: token,
			user: {
				id: userId,
				email: jwt.email,
				name: jwt.name,
				role: jwt.role,
				status: jwt.status,
			},
		}),
		{
			headers: {
				'Content-Type': 'application/json',
			},
		}
	);
}
