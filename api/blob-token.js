import { handleUpload } from '@vercel/blob/client';

const types = {
  uploads: ['application/pdf', 'text/plain', 'text/markdown'],
  chat_uploads: ['application/pdf', 'text/plain', 'text/markdown', 'image/png', 'image/jpeg', 'image/webp'],
};

export async function POST(request) {
  try {
    const result = await handleUpload({
      body: await request.json(),
      request,
      onBeforeGenerateToken: async (pathname) => {
        const url = new URL(request.url);
        if (request.headers.get('origin') !== url.origin) throw new Error('Request origin rejected.');
        const sessionResponse = await fetch(new URL('/api/auth/session', url), {
          headers: { cookie: request.headers.get('cookie') || '' },
          cache: 'no-store',
        });
        if (!sessionResponse.ok) throw new Error('Session unavailable.');
        const session = await sessionResponse.json();
        const userId = session.user?.userId;
        if (!userId || !session.user.profileComplete) throw new Error('Sign in to upload files.');
        const match = /^(uploads|chat_uploads)\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/.exec(pathname);
        if (!match || match[2] !== userId) throw new Error('Invalid upload path.');
        return {
          allowedContentTypes: types[match[1]],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: false,
        };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(result);
  } catch (error) {
    console.error('Blob upload token failed:', error);
    return Response.json({ error: 'File upload could not be authorized.' }, { status: 400 });
  }
}
