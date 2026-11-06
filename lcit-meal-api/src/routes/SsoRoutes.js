const express = require('express');
const ApiResponse = require('../ultis/ApiResponse');

const COOKIE = '__Host-lcit_sso';
const cookieOptions = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };
function flowCookie(req) {
  const entries = (req.headers.cookie || '').split(';').map(value => value.trim());
  const matches = entries.filter(value => value.startsWith(`${COOKIE}=`));
  return matches.length === 1 ? matches[0].slice(COOKIE.length + 1) : undefined;
}

module.exports = function ssoRoutes(service) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  router.get('/config', (req, res) => ApiResponse.success(res, service.status()));
  router.get('/start', async (req, res) => {
    try {
      const { authorization, cookie } = await service.begin();
      res.cookie(COOKIE, cookie, { ...cookieOptions, maxAge: 10 * 60 * 1000 });
      return res.redirect(authorization);
    } catch {
      return ApiResponse.error(res, 'Đăng nhập SSO đang chờ cấu hình hoặc tạm thời chưa khả dụng.', 503);
    }
  });
  router.get('/callback', async (req, res) => {
    try {
      service.assertEnabled();
      const current = new URL(service.settings.redirectUri);
      current.search = req.originalUrl.split('?')[1] || '';
      return res.redirect(await service.finish(current.toString(), flowCookie(req)));
    } catch (error) {
      res.clearCookie(COOKIE, cookieOptions);
      if (!service.status().enabled) return ApiResponse.error(res, 'Đăng nhập SSO chưa được cấu hình.', 503);
      const target = new URL('/login', service.settings.frontendOrigin);
      target.searchParams.set('sso_error', error.ssoCode === 'unlinked' ? 'unlinked' : 'invalid_response');
      return res.redirect(target.toString());
    }
  });
  router.post('/exchange', async (req, res) => {
    try {
      const result = await service.exchange(req.body?.ticket, flowCookie(req), req.headers.origin,
        { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
      res.clearCookie(COOKIE, cookieOptions);
      return ApiResponse.success(res, result);
    } catch (error) {
      // Do not send provider responses, tokens, or client credentials to the browser/logs.
      return ApiResponse.error(res, 'Không hoàn tất được đăng nhập SSO. Vui lòng đăng nhập lại hoặc liên hệ quản trị.',
        [400, 403, 503].includes(error.statusCode) ? error.statusCode : 500);
    }
  });
  return router;
};
