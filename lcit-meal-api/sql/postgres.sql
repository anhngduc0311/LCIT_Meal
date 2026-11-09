-- PostgreSQL schema. Safe to apply again; never deletes existing application data.
CREATE TABLE IF NOT EXISTS "user" (
  id SERIAL PRIMARY KEY, full_name VARCHAR(150) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
  auth_key VARCHAR(32) NOT NULL, access_token VARCHAR(255) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT '1', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER, updated_at TIMESTAMP, updated_by INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_username_lower ON "user" (LOWER(username));
UPDATE "user" SET status = '1' WHERE status IN ('active', 'acitve');
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone VARCHAR(32);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_phone ON "user" (phone) WHERE phone IS NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS facility_id SMALLINT CHECK(facility_id IN (1,2));
CREATE TABLE IF NOT EXISTS role (
  id SERIAL PRIMARY KEY, display_name VARCHAR(150) NOT NULL, code VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255), status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by INTEGER, updated_at TIMESTAMP, updated_by INTEGER
);
CREATE TABLE IF NOT EXISTS user_role (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES role(id), status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by INTEGER, updated_at TIMESTAMP, updated_by INTEGER,
  UNIQUE(user_id, role_id)
);
CREATE TABLE IF NOT EXISTS meal (
  id SERIAL PRIMARY KEY, meal_date DATE NOT NULL UNIQUE,
  is_cancelled SMALLINT NOT NULL DEFAULT 0 CHECK (is_cancelled IN (0,1)),
  cancelled_by INTEGER REFERENCES "user"(id) ON DELETE SET NULL, note VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS meal_guest_count (
  meal_id INTEGER NOT NULL REFERENCES meal(id) ON DELETE CASCADE,
  facility_id INTEGER NOT NULL CHECK (facility_id IN (1,2)),
  guest_count INTEGER NOT NULL DEFAULT 0 CHECK (guest_count >= 0),
  updated_by INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (meal_id, facility_id)
);
CREATE TABLE IF NOT EXISTS meal_registration (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES "user"(id),
  meal_id INTEGER NOT NULL REFERENCES meal(id), guest_count INTEGER NOT NULL DEFAULT 0 CHECK (guest_count BETWEEN 0 AND 10),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('confirmed','pending','completed','cancelled')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,meal_id)
);
CREATE INDEX IF NOT EXISTS idx_registration_meal_status ON meal_registration(meal_id,status);
CREATE TABLE IF NOT EXISTS meal_option (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES "user"(id), type VARCHAR(50) NOT NULL,
  from_date DATE NOT NULL, to_date DATE NOT NULL, note VARCHAR(255), status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by INTEGER, updated_at TIMESTAMP,
  updated_by INTEGER, approved_at TIMESTAMP, approved_by INTEGER, CHECK(to_date >= from_date)
);
CREATE TABLE IF NOT EXISTS payment (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES "user"(id), payment_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0, is_paid SMALLINT NOT NULL DEFAULT 0 CHECK(is_paid IN (0,1)),
  paid_at TIMESTAMP, paid_amount NUMERIC(14,2), bill_img VARCHAR(255), status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
);
CREATE INDEX IF NOT EXISTS idx_payment_user_date ON payment(user_id,payment_date);
CREATE TABLE IF NOT EXISTS notification (
  id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, content TEXT, url VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER, updated_at TIMESTAMP, updated_by INTEGER
);
CREATE TABLE IF NOT EXISTS notification_recipient (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  notification_id INTEGER NOT NULL REFERENCES notification(id) ON DELETE CASCADE,
  is_seen SMALLINT NOT NULL DEFAULT 0 CHECK(is_seen IN (0,1)), seen_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recipient_user ON notification_recipient(user_id,is_seen);
CREATE TABLE IF NOT EXISTS system_setting (
  id SERIAL PRIMARY KEY, setting_key VARCHAR(100) NOT NULL UNIQUE, setting_value VARCHAR(255),
  display_name VARCHAR(255), data_type VARCHAR(20) NOT NULL DEFAULT 'string', description VARCHAR(255),
  updated_at TIMESTAMP, updated_by INTEGER, auto_schedule_use_meal_config SMALLINT NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS meal_schedule_config (
  id SERIAL PRIMARY KEY, day_of_week SMALLINT NOT NULL UNIQUE CHECK(day_of_week BETWEEN 0 AND 6),
  is_enabled SMALLINT NOT NULL DEFAULT 1 CHECK(is_enabled IN (0,1)), notes VARCHAR(255), updated_by INTEGER,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS holiday_event (
  id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, reason VARCHAR(500), from_date DATE NOT NULL,
  to_date DATE NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_by INTEGER, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, restored_by INTEGER,
  restored_at TIMESTAMP, CHECK(to_date >= from_date)
);
CREATE TABLE IF NOT EXISTS holiday_event_meal (
  event_id INTEGER NOT NULL REFERENCES holiday_event(id) ON DELETE CASCADE,
  meal_id INTEGER NOT NULL REFERENCES meal(id) ON DELETE CASCADE, PRIMARY KEY(event_id,meal_id)
);
CREATE TABLE IF NOT EXISTS holiday_event_registration (
  event_id INTEGER NOT NULL REFERENCES holiday_event(id) ON DELETE CASCADE,
  registration_id INTEGER NOT NULL REFERENCES meal_registration(id) ON DELETE CASCADE,
  previous_status VARCHAR(20) NOT NULL, PRIMARY KEY(event_id,registration_id)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY, log_actor INTEGER, log_action VARCHAR(100) NOT NULL, log_target VARCHAR(150),
  log_result VARCHAR(50), log_detail TEXT, log_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45), user_agent VARCHAR(255), status VARCHAR(20) NOT NULL DEFAULT 'success',
  old_data TEXT CHECK(old_data IS NULL OR old_data::jsonb IS NOT NULL),
  new_data TEXT CHECK(new_data IS NULL OR new_data::jsonb IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS migration (version VARCHAR(180) PRIMARY KEY, apply_time INTEGER);

-- Match MySQL's ON UPDATE timestamps when repository updates omit that field.
CREATE OR REPLACE FUNCTION appmeal_touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$;
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['user','user_role','role','meal_option','notification','system_setting','meal_schedule_config'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'touch_' || t
      AND tgrelid = to_regclass(format('%I.%I', current_schema(), t))) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION appmeal_touch_updated_at()', 'touch_' || t, t);
    END IF;
  END LOOP;
END $$;

INSERT INTO role(display_name,code,description) VALUES
 ('Quản trị viên','admin','Quản trị hệ thống'), ('Quản lý bếp ăn','manager','Quản lý suất ăn và thanh toán'),
 ('Nhân viên','employee','Đăng ký suất ăn'), ('Nhân viên bếp','kitchen','Xem số suất cần nấu') ON CONFLICT(code) DO NOTHING;
INSERT INTO system_setting(setting_key,setting_value,display_name,data_type) VALUES
 ('registration_close_time','08:00','Thời gian đóng đăng ký','string'),
 ('meal_price','30000','Giá suất ăn','integer'), ('guest_meal_price','30000','Giá suất khách','integer'),
 ('auto_register_enabled','0','Tự động đăng ký','boolean'),
 ('max_guest_per_registration','10','Số khách tối đa','integer') ON CONFLICT(setting_key) DO NOTHING;
