type UploadKind = 'files' | 'chat-files';

const mimeTypes: Record<string, string> = {
  pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
};

export async function postFile(kind: UploadKind, file: File, fields: Record<string, string> = {}): Promise<Response> {
  const endpoint = `/api/${kind}`;
  if (file.size <= 4 * 1024 * 1024) {
    const form = new FormData();
    form.set('file', file);
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return fetch(endpoint, { method: 'POST', body: form });
  }

  if (file.size > 10 * 1024 * 1024) throw new Error('Files are limited to 10 MB.');
  const sessionResponse = await fetch('/api/auth/session', { cache: 'no-store' });
  if (!sessionResponse.ok) throw new Error('Sign in to upload files.');
  const session = await sessionResponse.json();
  const userId: string | undefined = session.user?.userId;
  if (!userId) throw new Error('Sign in to upload files.');

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const contentType = mimeTypes[extension];
  if (!contentType || (kind === 'files' && !['pdf', 'txt', 'md'].includes(extension))) {
    throw new Error('This file type is not supported.');
  }
  const { upload } = await import('@vercel/blob/client');
  const category = kind === 'files' ? 'uploads' : 'chat_uploads';
  const pathname = `${category}/${userId}/${crypto.randomUUID()}`;
  const blob = await upload(pathname, file, {
    access: 'private',
    handleUploadUrl: '/api/blob-token',
    contentType,
  });
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fields, filename: file.name, blobPath: blob.pathname }),
  });
}
