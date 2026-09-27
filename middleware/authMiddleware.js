/**
 * Authentication Middleware
 * Protects routes by ensuring an active, authenticated session exists.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({
    error: 'Unauthorized: Please log in to access this resource.'
  });
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
