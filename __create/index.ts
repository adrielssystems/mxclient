import { AsyncLocalStorage } from 'node:async_hooks';
import nodeConsole from 'node:console';
import Credentials from '@auth/core/providers/credentials';
import { authHandler, initAuthConfig } from '@hono/auth-js';
import sql from '../src/app/api/utils/sql';
import { hash, verify } from 'argon2';
import { Hono } from 'hono';
import { contextStorage, getContext } from 'hono/context-storage';
import { cors } from 'hono/cors';
import { proxy } from 'hono/proxy';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import { csrf } from 'hono/csrf';
import { createHonoServer } from 'react-router-hono-server/node';
import { serializeError } from 'serialize-error';
import NeonAdapter from './adapter';
import { getHTMLForErrorPage } from './get-html-for-error-page';
import { isAuthAction } from './is-auth-action';
import { API_BASENAME, api } from './route-builder';
import botWebhook from './bot-webhook';
import { rateLimiter } from '../src/app/api/utils/security';

const als = new AsyncLocalStorage<{ requestId: string }>();

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
  const original = nodeConsole[method].bind(console);

  console[method] = (...args: unknown[]) => {
    const requestId = als.getStore()?.requestId;
    if (requestId) {
      original(`[traceId:${requestId}]`, ...args);
    } else {
      original(...args);
    }
  };
}

const adapter = NeonAdapter(sql);

const app = new Hono();

app.use('*', requestId());
app.use('*', csrf());

// 🛡️ Fail-Safe Security Headers (MotorX Custom Middleware)
// Instead of Hono's secureHeaders(), we use a manual approach to avoid
// 'TypeError: immutable' on native fetch Responses (Auth.js, Proxy, Redirects).
app.use('*', async (c, next) => {
  await next();
  if (c.res && c.res.headers) {
    const setSafe = (key: string, value: string) => {
      try {
        c.res.headers.set(key, value);
      } catch (e) {
        // Silently ignore immutable headers to prevent server crash
      }
    };
    setSafe('X-Frame-Options', 'SAMEORIGIN');
    setSafe('X-Content-Type-Options', 'nosniff');
    setSafe('X-XSS-Protection', '0');
    setSafe('Referrer-Policy', 'no-referrer');
  }
});

app.use('*', (c, next) => {
  const requestId = c.get('requestId');
  return als.run({ requestId }, () => next());
});

app.use(contextStorage());

app.onError((err, c) => {
  if (c.req.method !== 'GET') {
    return c.json(
      {
        error: 'An error occurred in your app',
        details: serializeError(err),
      },
      500
    );
  }
  return c.html(getHTMLForErrorPage(err), 200);
});

if (process.env.CORS_ORIGINS) {
  app.use(
    '/*',
    cors({
      origin: process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    })
  );
}
for (const method of ['post', 'put', 'patch'] as const) {
  app[method](
    '*',
    bodyLimit({
      maxSize: 4.5 * 1024 * 1024, // 4.5mb to match vercel limit
      onError: (c) => {
        return c.json({ error: 'Body size limit exceeded' }, 413);
      },
    })
  );
}

if (process.env.AUTH_SECRET) {
  app.use(
    '*',
    initAuthConfig((c) => ({
      secret: process.env.AUTH_SECRET,
      basePath: '/api/auth',
      trustHost: true,
      pages: {
        signIn: '/account/signin',
        signOut: '/account/logout',
      },
      // Automatic cookie management for better production compatibility
      cookies: {
        sessionToken: {
          name: `authjs.session-token`,
          options: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
            domain: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false' ? '.motorxcars.com' : undefined,
          },
        },
      },
      session: {
        strategy: 'jwt',
        maxAge: 30 * 60, // 30 minutes
        updateAge: 5 * 60, // 5 minutes
      },
      providers: [
        Credentials({
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
            console.log('Attempting login for:', email);
            const user = await adapter.getUserByEmail(email);
            if (!user) {
              console.log('[Auth Error] User not found in DB:', email);
              return null;
            }
            console.log('[Auth Debug] User found:', { email: user.email, status: (user as any).status, role: (user as any).role });

            // Account status check
            if ((user as any).status === 'inactive') {
              console.log('[Auth Error] Account is inactive:', email);
              return null; 
            }

            const matchingAccount = user.accounts.find(
              (account) => account.provider === 'credentials'
            );
            if (!matchingAccount) {
              console.log('[Auth Error] No credentials account linked for:', email);
              return null;
            }
            const accountPassword = matchingAccount?.password;
            if (!accountPassword) {
              console.log('[Auth Error] No password found for account:', email);
              return null;
            }

            const isValid = await verify(accountPassword, password);
            if (!isValid) {
              console.log('[Auth Error] Password verification failed for:', email);
              return null;
            }
            console.log('[Auth Success] Login successful for:', email);

            // return user object with the their profile data
            return user;
          },
        }),
        Credentials({
          id: 'credentials-signup',
          name: 'Credentials Sign up',
          credentials: {
            email: {
              label: 'Email',
              type: 'email',
            },
            password: {
              label: 'Password',
              type: 'password',
            },
            name: { label: 'Name', type: 'text' },
            image: { label: 'Image', type: 'text', required: false },
          },
          authorize: async (credentials) => {
            const { email, password, name, image } = credentials;
            if (!email || !password) {
              return null;
            }
            if (typeof email !== 'string' || typeof password !== 'string') {
              return null;
            }

            // logic to verify if user exists
            const user = await adapter.getUserByEmail(email);
            if (!user) {
              const newUser = await adapter.createUser({
                id: crypto.randomUUID(),
                emailVerified: null,
                email,
                name: typeof name === 'string' && name.length > 0 ? name : undefined,
                image: typeof image === 'string' && image.length > 0 ? image : undefined,
              });
              await adapter.linkAccount({
                extraData: {
                  password: await hash(password),
                },
                type: 'credentials',
                userId: newUser.id,
                providerAccountId: newUser.id,
                provider: 'credentials',
              });
              return newUser;
            }
            return null;
          },
        }),
      ],
      callbacks: {
        async signIn({ user, account, profile, email, credentials }) {
          console.log('SignIn callback called');
          console.log('SignIn User:', user ? user.id : 'no-user');
          return true;
        },
        async jwt({ token, user }) {
          console.log('JWT callback called');
          if (user) {
            console.log('JWT User:', user.id, 'Role:', (user as any).role, 'Status:', (user as any).status);
            token.id = user.id;
            token.role = (user as any).role;
            token.status = (user as any).status;
          }
          return token;
        },
        session({ session, token }) {
          if (token.id) {
            session.user.id = token.id as string;
          }
          if (token.role) {
            (session.user as any).role = token.role;
          }
          if (token.status) {
            (session.user as any).status = token.status;
          }
          return session;
        },
      },
    }))
  );
}
app.all('/integrations/:path{.+}', async (c, next) => {
  const queryParams = c.req.query();
  const url = `${process.env.NEXT_PUBLIC_CREATE_BASE_URL ?? 'https://www.create.xyz'}/integrations/${c.req.param('path')}${Object.keys(queryParams).length > 0 ? `?${new URLSearchParams(queryParams).toString()}` : ''}`;

  return proxy(url, {
    method: c.req.method,
    body: c.req.raw.body ?? null,
    // @ts-ignore - this key is accepted even if types not aware and is
    // required for streaming integrations
    duplex: 'half',
    redirect: 'manual',
    headers: {
      ...c.req.header(),
      'X-Forwarded-For': process.env.NEXT_PUBLIC_CREATE_HOST,
      'x-createxyz-host': process.env.NEXT_PUBLIC_CREATE_HOST,
      Host: process.env.NEXT_PUBLIC_CREATE_HOST,
      'x-createxyz-project-group-id': process.env.NEXT_PUBLIC_PROJECT_GROUP_ID,
    },
  });
});

// 🛑 Login Rate Limiter (Anti-Brute Force)
const loginLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Please wait 1 minute.'
});
app.use('/api/auth/signin/credentials', loginLimiter);

// 🤖 M2M Bot Webhook Sub-app
app.route('/api/webhooks/bot', botWebhook);

// 🛡️ L7 DoS Protection: Heavy Ops Limiter
const heavyOpsLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 100, // Increased to allow more administrative headroom
  message: 'Too many heavy operations requested. Try again later.'
});
app.use('/api/upload', heavyOpsLimiter);
app.use('/api/client/reports', heavyOpsLimiter);
app.use('/api/admin/reports', heavyOpsLimiter);
app.use('/api/vehicles/import-csv', heavyOpsLimiter);

// 🛡️ L7 DoS Protection: Global API Limiter
const baseApiLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: 'Global API Rate Limit Exceeded. Please try again later.'
});

app.use('/api/*', async (c, next) => {
  const userAgent = c.req.header('user-agent')?.toLowerCase() || '';
  // Excepción IPs/UAs de confianza (n8n/QuickBooks)
  if (userAgent.includes('n8n') || userAgent.includes('intuit') || userAgent.includes('quickbooks')) {
    return next();
  }
  return baseApiLimiter(c, next);
});

app.use('/api/auth/*', async (c, next) => {
  if (isAuthAction(c.req.path)) {
    return authHandler()(c, next);
  }
  return next();
});
app.route(API_BASENAME, api);

export default await createHonoServer({
  app,
  defaultLogger: false,
  port: Number(process.env.PORT) || 4000,
  hostname: process.env.HOST || '0.0.0.0',
});
