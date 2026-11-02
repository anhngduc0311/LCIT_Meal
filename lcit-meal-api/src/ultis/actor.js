const extractRoles = (user) => {
  if (!user) return [];
  const set = new Set();
  const add = (r) => {
    if (!r) return;
    if (typeof r === "string") set.add(r.toLowerCase());
    else if (typeof r === "object") {
      if (r.code) set.add(String(r.code).toLowerCase());
      if (r.name) set.add(String(r.name).toLowerCase());
    }
  };
  add(user.role);
  if (Array.isArray(user.roles)) {
    user.roles.forEach(add);
  }
  return Array.from(set);
};

const getActor = (req) => ({
  actorId: req.user ? req.user.id : null,
  roles: extractRoles(req.user),
  ipAddress: req.ip,
  userAgent: req.headers ? req.headers["user-agent"] : null,
});

module.exports = {
  extractRoles,
  getActor,
};
