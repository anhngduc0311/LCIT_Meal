class User {
  constructor(data) {
    this.id = data.id;
    this.fullName = data.full_name;
    this.phone = data.phone ?? null;
    this.facilityId = data.facility_id ?? null;
    this.username = data.username;
    this.passwordHash = data.password_hash;
    this.authKey = data.auth_key;
    this.accessToken = data.access_token;
    this.status = data.status;
    this.createdAt = data.created_at;
    this.createdBy = data.created_by;
    this.updatedAt = data.updated_at;
    this.updatedBy = data.updated_by;
    this.roles = data.roles || [];
  }

  // Không bao giờ để lộ các field nhạy cảm ra ngoài API.
  // Express tự gọi toJSON() khi res.json() serialize object này,
  // kể cả khi User nằm trong 1 mảng hoặc lồng trong object khác (vd: { user, accessToken }).
  toJSON() {
    const { passwordHash, authKey, accessToken, ...safeData } = this;
    return safeData;
  }
}

module.exports = User;
