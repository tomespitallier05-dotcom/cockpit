CREATE UNIQUE INDEX IF NOT EXISTS "workspace_owner_idx" ON "workspace" USING btree ("owner_id");
