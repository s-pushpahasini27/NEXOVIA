export async function api(action: string, data: any = {}) {
  const response = await fetch('/api/workspace', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
  });
  const result = await response.json().catch(() => { throw new Error('The server returned an unreadable response. Please retry.'); });
  if (!response.ok || result.error) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}
