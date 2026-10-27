CREATE TABLE "ai_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_thread" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"feature" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"kind" text NOT NULL,
	"extracted_text" text,
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"recording_consent" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"role" text,
	"relationship" text DEFAULT 'other' NOT NULL,
	"company" text,
	"email" text,
	"phone" text,
	"handles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"last_interaction_at" timestamp with time zone,
	"next_interaction_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"type" text DEFAULT 'note' NOT NULL,
	"title" text,
	"content" jsonb,
	"plain_text" text DEFAULT '' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"inbox_status" text DEFAULT 'inbox' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry_contact" (
	"entry_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"role" text DEFAULT 'participant' NOT NULL,
	CONSTRAINT "entry_contact_entry_id_contact_id_pk" PRIMARY KEY("entry_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "entry_link" (
	"from_entry_id" uuid NOT NULL,
	"to_entry_id" uuid NOT NULL,
	CONSTRAINT "entry_link_from_entry_id_to_entry_id_pk" PRIMARY KEY("from_entry_id","to_entry_id")
);
--> statement-breakpoint
CREATE TABLE "entry_tag" (
	"entry_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "entry_tag_entry_id_tag_id_pk" PRIMARY KEY("entry_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "goal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"period" text DEFAULT 'month' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"kind" text DEFAULT 'milestone' NOT NULL,
	"metric_id" uuid,
	"start_value" numeric(14, 2),
	"target_value" numeric(14, 2),
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insight" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"source_entry_id" uuid NOT NULL,
	"contact_id" uuid,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"quote" text,
	"source_offset_sec" integer,
	"status" text DEFAULT 'proposed' NOT NULL,
	"applied_at" timestamp with time zone,
	"confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"brand" text,
	"condition" text,
	"sourced_from" text,
	"platform" text,
	"buy_price_cents" integer NOT NULL,
	"sell_price_cents" integer,
	"fees_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'sourced' NOT NULL,
	"bought_on" date,
	"listed_on" date,
	"sold_on" date,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"unit" text,
	"direction" text DEFAULT 'up' NOT NULL,
	"aggregation" text DEFAULT 'last' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_id" uuid NOT NULL,
	"date" date NOT NULL,
	"value" numeric(14, 2) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text DEFAULT 'folder' NOT NULL,
	"color" text DEFAULT 'slate' NOT NULL,
	"template" text DEFAULT 'blank' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_contact" (
	"project_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	CONSTRAINT "project_contact_project_id_contact_id_pk" PRIMARY KEY("project_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "reminder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"message" text,
	"remind_at" timestamp with time zone NOT NULL,
	"channel" text DEFAULT 'in_app' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"period" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"content" jsonb,
	"summary" text,
	"metrics_snapshot" jsonb,
	"generated_by" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_period_unique" UNIQUE NULLS NOT DISTINCT("workspace_id","project_id","period","period_start")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'none' NOT NULL,
	"due_at" timestamp with time zone,
	"estimate_minutes" integer,
	"actual_minutes" integer,
	"source_entry_id" uuid,
	"source_insight_id" uuid,
	"promised_to_contact_id" uuid,
	"recurrence" text,
	"position" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Paris' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_message" ADD CONSTRAINT "ai_message_thread_id_ai_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."ai_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_thread" ADD CONSTRAINT "ai_thread_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_thread" ADD CONSTRAINT "ai_thread_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_entry_id_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_contact" ADD CONSTRAINT "entry_contact_entry_id_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_contact" ADD CONSTRAINT "entry_contact_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_link" ADD CONSTRAINT "entry_link_from_entry_id_entry_id_fk" FOREIGN KEY ("from_entry_id") REFERENCES "public"."entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_link" ADD CONSTRAINT "entry_link_to_entry_id_entry_id_fk" FOREIGN KEY ("to_entry_id") REFERENCES "public"."entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_tag" ADD CONSTRAINT "entry_tag_entry_id_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_tag" ADD CONSTRAINT "entry_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_metric_id_metric_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."metric"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight" ADD CONSTRAINT "insight_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight" ADD CONSTRAINT "insight_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight" ADD CONSTRAINT "insight_source_entry_id_entry_id_fk" FOREIGN KEY ("source_entry_id") REFERENCES "public"."entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight" ADD CONSTRAINT "insight_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric" ADD CONSTRAINT "metric_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric" ADD CONSTRAINT "metric_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_value" ADD CONSTRAINT "metric_value_metric_id_metric_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."metric"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_contact" ADD CONSTRAINT "project_contact_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_contact" ADD CONSTRAINT "project_contact_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_source_entry_id_entry_id_fk" FOREIGN KEY ("source_entry_id") REFERENCES "public"."entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_source_insight_id_insight_id_fk" FOREIGN KEY ("source_insight_id") REFERENCES "public"."insight"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_promised_to_contact_id_contact_id_fk" FOREIGN KEY ("promised_to_contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_message_thread_idx" ON "ai_message" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_workspace_month_idx" ON "ai_usage" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "attachment_entry_idx" ON "attachment" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "contact_workspace_idx" ON "contact" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "entry_workspace_occurred_idx" ON "entry" USING btree ("workspace_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "entry_project_occurred_idx" ON "entry" USING btree ("project_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "entry_inbox_idx" ON "entry" USING btree ("workspace_id","inbox_status") WHERE "entry"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "entry_link_to_idx" ON "entry_link" USING btree ("to_entry_id");--> statement-breakpoint
CREATE INDEX "goal_workspace_period_idx" ON "goal" USING btree ("workspace_id","ends_on");--> statement-breakpoint
CREATE INDEX "insight_workspace_type_idx" ON "insight" USING btree ("workspace_id","type","status");--> statement-breakpoint
CREATE INDEX "insight_contact_idx" ON "insight" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "insight_source_idx" ON "insight" USING btree ("source_entry_id");--> statement-breakpoint
CREATE INDEX "inventory_project_status_idx" ON "inventory_item" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "metric_project_idx" ON "metric" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_value_metric_date_idx" ON "metric_value" USING btree ("metric_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "project_workspace_slug_idx" ON "project" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "reminder_due_idx" ON "reminder" USING btree ("remind_at") WHERE "reminder"."sent_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "tag_workspace_name_idx" ON "tag" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "task_workspace_status_idx" ON "task" USING btree ("workspace_id","status","due_at");--> statement-breakpoint
CREATE INDEX "task_project_idx" ON "task" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");