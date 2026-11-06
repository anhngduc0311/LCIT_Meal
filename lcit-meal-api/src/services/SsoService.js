const crypto = require('node:crypto');
const AppError = require('../ultis/AppError');
const { validSsoSettings } = require('../config/sso');

const random = () => crypto.randomBytes(32).toString('base64url');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const boundTo = (hash, cookie) => typeof cookie === 'string'
  && crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(digest(cookie), 'hex'));

class SsoService {
  constructor(settings, authService, options = {}) {
    this.settings = settings;
    this.authService = authService;
    this.clock = options.clock || Date.now;
    this.fetch = options.fetch || global.fetch;
    this.loadClient = options.loadClient || (() => import('openid-client'));
    this.pending = new Map();
    this.tickets = new Map();
    this.mobileRequests = new Map();
    this.configurationPromise = null;
  }

  status() {
    return { enabled: validSsoSettings(this.settings), label: 'SSO Lào Cai' };
  }

  assertEnabled() {
    if (!this.status().enabled) throw new AppError('Đăng nhập SSO đang chờ cấu hình từ quản trị hệ thống.', 503);
  }

  prune() {
    const now = this.clock();
    for (const store of [this.pending, this.tickets, this.mobileRequests]) {
      for (const [key, value] of store) if (value.expires <= now) store.delete(key);
    }
  }

  assertCapacity() {
    if (this.pending.size + this.tickets.size + this.mobileRequests.size >= 1000) throw new AppError('SSO đang bận. Vui lòng thử lại sau.', 503);
  }

  async configuration() {
    this.assertEnabled();
    if (!this.configurationPromise) {
      this.configurationPromise = (async () => {
        const oidc = await this.loadClient();
        const response = await this.fetch(this.settings.discoveryUrl, { signal: AbortSignal.timeout(10000), redirect: 'error' });
        if (!response.ok) throw new Error('OIDC discovery failed');
        const metadata = await response.json();
        if (metadata.issuer !== this.settings.issuer) throw new Error('OIDC issuer mismatch');
        const trustedOrigin = new URL(this.settings.discoveryUrl).origin;
        for (const name of ['authorization_endpoint', 'token_endpoint', 'jwks_uri', 'userinfo_endpoint']) {
          const endpoint = new URL(metadata[name]);
          if (endpoint.protocol !== 'https:' || endpoint.origin !== trustedOrigin || endpoint.username || endpoint.password) {
            throw new Error('Untrusted OIDC endpoint');
          }
        }
        if (!metadata.code_challenge_methods_supported?.includes('S256')) throw new Error('Provider must support PKCE S256');
        const authenticate = this.settings.tokenAuthMethod === 'client_secret_basic'
          ? oidc.ClientSecretBasic(this.settings.clientSecret) : oidc.ClientSecretPost(this.settings.clientSecret);
        const config = new oidc.Configuration(metadata, this.settings.clientId,
          { client_secret: this.settings.clientSecret, id_token_signed_response_alg: 'RS256' }, authenticate);
        config.timeout = 10;
        oidc.enableNonRepudiationChecks(config);
        return { oidc, config, metadata };
      })().catch(error => { this.configurationPromise = null; throw error; });
    }
    return this.configurationPromise;
  }

  prepareMobile(redirectUri) {
    this.assertEnabled();
    this.prune();
    this.assertCapacity();
    const allowed = this.settings.mobileRedirectUris || ['lcitmealmobile://sso/callback'];
    if (typeof redirectUri !== 'string' || !allowed.includes(redirectUri)) throw new AppError('Đường dẫn trở về app không hợp lệ.', 400);
    const target = new URL(redirectUri);
    if (target.search || target.hash || target.username || target.password) throw new AppError('Đường dẫn trở về app không hợp lệ.', 400);
    const request = random(), verifier = random();
    this.mobileRequests.set(digest(request), { redirectUri, challenge: digest(verifier), expires: this.clock() + 600000 });
    const start = new URL(this.settings.redirectUri);
    start.pathname = start.pathname.replace(/\/callback$/, '/mobile/start');
    start.search = new URLSearchParams({ request }).toString();
    return { startUrl: start.toString(), redirectUri, verifier };
  }

  async beginMobile(request) {
    this.assertEnabled();
    this.prune();
    if (typeof request !== 'string' || !/^[\w-]{43}$/.test(request)) throw new AppError('Phiên SSO không hợp lệ.', 400);
    const key = digest(request), mobile = this.mobileRequests.get(key);
    if (!mobile) throw new AppError('Phiên SSO không hợp lệ hoặc đã hết hạn.', 400);
    this.mobileRequests.delete(key);
    return this.begin(mobile);
  }

  mobileTarget(redirectUri, values) {
    const target = new URL(redirectUri);
    target.search = new URLSearchParams(values).toString();
    return target.toString();
  }

  async begin(mobile) {
    this.assertEnabled();
    this.prune();
    this.assertCapacity();
    const { oidc, config } = await this.configuration();
    const state = random(), cookie = random(), nonce = random();
    const verifier = oidc.randomPKCECodeVerifier();
    const challenge = await oidc.calculatePKCECodeChallenge(verifier);
    const authorization = oidc.buildAuthorizationUrl(config, {
      response_type: 'code', response_mode: 'query', scope: 'openid phone',
      claims: JSON.stringify({ userinfo: { sdt: { essential: true } } }),
      redirect_uri: this.settings.redirectUri, state, nonce,
      code_challenge: challenge, code_challenge_method: 'S256',
    });
    this.assertCapacity();
    this.pending.set(state, { cookieHash: digest(cookie), nonce, verifier, mobile, expires: this.clock() + 10 * 60 * 1000 });
    return { authorization: authorization.toString(), cookie };
  }

  async finish(callbackUrl, cookie) {
    this.assertEnabled();
    this.prune();
    const url = new URL(callbackUrl);
    const denied = url.searchParams.getAll('error').length === 1 && url.searchParams.getAll('code').length === 0;
    if (url.origin !== new URL(this.settings.redirectUri).origin || url.pathname !== new URL(this.settings.redirectUri).pathname
      || url.searchParams.getAll('state').length !== 1 || (!denied && url.searchParams.getAll('code').length !== 1)) {
      throw new AppError('Phản hồi SSO không hợp lệ.', 400);
    }
    const state = url.searchParams.get('state');
    const flow = this.pending.get(state);
    if (!flow || flow.expires <= this.clock() || !boundTo(flow.cookieHash, cookie)) {
      throw new AppError('Phiên đăng nhập SSO không hợp lệ hoặc đã hết hạn.', 400);
    }
    this.pending.delete(state);
    try {
    if (denied) {
      const error = new AppError('Đăng nhập SSO đã bị hủy.', 400);
      error.ssoCode = url.searchParams.get('error') === 'access_denied' ? 'cancelled' : 'invalid_response';
      throw error;
    }
    const { oidc, config, metadata } = await this.configuration();
    const tokens = await oidc.authorizationCodeGrant(config, url, {
      expectedState: state, expectedNonce: flow.nonce, pkceCodeVerifier: flow.verifier, idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims || claims.iss !== this.settings.issuer || typeof claims.sub !== 'string' || !claims.sub) {
      throw new AppError('Danh tính SSO không hợp lệ.', 401);
    }
    // This provider documents POST /oauth2/userinfo, rather than the default GET.
    const userResponse = await oidc.fetchProtectedResource(config, tokens.access_token,
      new URL(metadata.userinfo_endpoint), 'POST', undefined, new Headers({ Accept: 'application/json' }));
    if (!userResponse.ok) throw new Error('OIDC UserInfo failed');
    const info = await userResponse.json();
    if (info.sub !== claims.sub) throw new AppError('Danh tính SSO không khớp.', 401);
    const user = await this.authService.resolveSsoUser(info.sdt);
    const ticket = random();
    this.prune();
    this.assertCapacity();
    this.tickets.set(digest(ticket), { userId: user.id, phone: info.sdt, cookieHash: flow.cookieHash,
      mobileChallenge: flow.mobile?.challenge, expires: this.clock() + 60000 });
    if (flow.mobile) return this.mobileTarget(flow.mobile.redirectUri, { ticket });
    const target = new URL('/auth/sso/callback', this.settings.frontendOrigin);
    target.hash = new URLSearchParams({ ticket }).toString();
    return target.toString();
    } catch (error) {
      if (flow.mobile) error.mobileReturn = this.mobileTarget(flow.mobile.redirectUri,
        { error: ['unlinked', 'missing_phone', 'cancelled'].includes(error.ssoCode) ? error.ssoCode : 'invalid_response' });
      throw error;
    }
  }

  async exchangeMobile(ticket, verifier, meta) {
    this.assertEnabled();
    this.prune();
    if (typeof ticket !== 'string' || !/^[\w-]{43}$/.test(ticket)
      || typeof verifier !== 'string' || !/^[\w-]{43}$/.test(verifier)) throw new AppError('Yêu cầu SSO không hợp lệ.', 400);
    const key = digest(ticket), flow = this.tickets.get(key);
    if (!flow?.mobileChallenge || !boundTo(flow.mobileChallenge, verifier)) throw new AppError('Phiên SSO không hợp lệ hoặc đã hết hạn.', 400);
    this.tickets.delete(key);
    return this.authService.loginSsoUser(flow.userId, flow.phone, meta);
  }

  async exchange(ticket, cookie, origin, meta) {
    this.assertEnabled();
    this.prune();
    if (origin !== new URL(this.settings.frontendOrigin).origin || typeof ticket !== 'string' || !/^[\w-]{43}$/.test(ticket)) {
      throw new AppError('Yêu cầu SSO không hợp lệ.', 400);
    }
    const key = digest(ticket), flow = this.tickets.get(key);
    if (!flow || flow.mobileChallenge || flow.expires <= this.clock() || !boundTo(flow.cookieHash, cookie)) {
      throw new AppError('Phiên đăng nhập SSO không hợp lệ hoặc đã hết hạn.', 400);
    }
    this.tickets.delete(key);
    return this.authService.loginSsoUser(flow.userId, flow.phone, meta);
  }
}

module.exports = SsoService;
