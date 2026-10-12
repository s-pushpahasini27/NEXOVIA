export function connectorErrorRecovery(
  error: { status: string; message: string },
  connectorName: string,
  reconnectHref: string,
) {
  const needsAuth = ['401', '403', 'unauthorized', 'disconnected', 'expired'].includes(error.status.toLowerCase());
  const safeLink = reconnectHref.startsWith('/') && !reconnectHref.startsWith('//') || reconnectHref.startsWith('https://');
  return {
    message: error.message || `${connectorName} could not complete this request.`,
    action: needsAuth && safeLink ? { href: reconnectHref, label: `Reconnect ${connectorName}` } : null,
  };
}
