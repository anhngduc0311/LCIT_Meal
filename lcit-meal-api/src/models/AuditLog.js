const vietnamDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hourCycle: 'h23',
  timeZoneName: 'longOffset',
});

function formatAuditTime(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return value;
  const parts = Object.fromEntries(vietnamDateTime.formatToParts(value).map(({ type, value }) => [type, value]));
  const offset = parts.timeZoneName.replace('GMT', '') || 'Z';
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${parts.fractionalSecond}${offset}`;
}

class AuditLog {
  constructor(data) {
    ((this.id = data.id),
      (this.log_actor = data.log_actor),
      (this.actor_name = data.actor_name),
      (this.log_action = data.log_action),
      (this.log_target = data.log_target),
      (this.log_result = data.log_result),
      (this.log_detail = data.log_detail),
      (this.log_time = formatAuditTime(data.log_time)),
      (this.ip_address = data.ip_address),
      (this.user_agent = data.user_agent),
      (this.status = data.status),
      (this.old_data = data.old_data),
      (this.new_data = data.new_data));
  }
}

module.exports = AuditLog;
