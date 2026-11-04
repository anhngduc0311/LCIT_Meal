const ApiResponse = require("../ultis/ApiResponse");

class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  login = async (req, res, next) => {
    try {
      const { username, password } = req.body;

      const meta = {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      };

      const result = await this.authService.login(username, password, meta);

      return ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req, res, next) => {
    try {
        await this.authService.logout(req.user.id, req.token);
        return ApiResponse.success(res, null);
    }
    catch (error) {
        next(error);
    }
  };
}

module.exports = AuthController;
