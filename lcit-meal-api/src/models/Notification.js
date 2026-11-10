function vietnamTimestamp(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return value;
  const vietnamTime = new Date(value.getTime() + 7 * 60 * 60 * 1000);
  return vietnamTime.toISOString().replace('Z', '+07:00');
}

class Notification {
  constructor(data) {
    ((this.id = data.id),
      (this.title = data.title),
      (this.content = data.content),
      (this.url = data.url),
      (this.status = data.status),
      (this.created_at = data.created_at),
      (this.created_by = data.created_by),
      (this.updated_at = data.updated_at),
      (this.updated_by = data.updated_by));

    this.createdAt = vietnamTimestamp(data.created_at);

    if (data.is_seen !== undefined) {
      this.isSeen = !!Number(data.is_seen);
    }

    if (data.seen_at !== undefined) {
      this.seenAt = data.seen_at;
    }
  }
}

module.exports = Notification;
