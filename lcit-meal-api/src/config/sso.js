function loadSsoSettings(source = process.env) {
  return {
    enabled: source.SSO_ENABLED === 'true',
    discoveryUrl: source.SSO_DISCOVERY_URL || 'https://login.yenbai.gov.vn/oauth2/oidcdiscovery/.well-known/openid-configuration',
    // Keep :443: the provider uses this exact string in its issuer claim.
    issuer: source.SSO_ISSUER || 'https://login.yenbai.gov.vn:443/oauth2/token',
    clientId: source.SSO_CLIENT_ID || '',
    clientSecret: source.SSO_CLIENT_SECRET || '',
    tokenAuthMethod: source.SSO_TOKEN_AUTH_METHOD || 'client_secret_post',
    redirectUri: source.SSO_REDIRECT_URI || '',
    frontendOrigin: source.SSO_FRONTEND_ORIGIN || '',
  };
}

function validSsoSettings(settings) {
  if (!settings.enabled || !settings.clientId || !settings.clientSecret) return false;
  if (!['client_secret_post', 'client_secret_basic'].includes(settings.tokenAuthMethod)) return false;
  try {
    for (const value of [settings.discoveryUrl, settings.issuer, settings.redirectUri, settings.frontendOrigin]) {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) return false;
    }
    const frontend = new URL(settings.frontendOrigin);
    return frontend.pathname === '/' && new URL(settings.redirectUri).pathname === '/api/auth/sso/callback';
  } catch { return false; }
}

module.exports = { loadSsoSettings, validSsoSettings };
