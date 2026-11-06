-- Additive migration: existing accounts retain NULL phone and all local roles.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone VARCHAR(32);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_phone ON "user" (phone) WHERE phone IS NOT NULL;
