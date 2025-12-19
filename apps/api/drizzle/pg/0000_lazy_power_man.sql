CREATE TABLE "app_config" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"is_encrypted" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"gmail_id" text NOT NULL,
	"gmail_account_id" varchar(21) NOT NULL,
	"thread_id" text,
	"subject" text,
	"snippet" text,
	"from_email" text NOT NULL,
	"from_name" text,
	"labels" text,
	"category" text,
	"size_bytes" integer,
	"has_attachments" integer DEFAULT 0,
	"is_unread" integer DEFAULT 0,
	"is_starred" integer DEFAULT 0,
	"is_trash" integer DEFAULT 0,
	"is_spam" integer DEFAULT 0,
	"is_important" integer DEFAULT 0,
	"internal_date" bigint,
	"synced_at" bigint,
	"unsubscribe_link" text
);
--> statement-breakpoint
CREATE TABLE "gmail_accounts" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"email" text NOT NULL,
	"sync_status" text DEFAULT 'idle' NOT NULL,
	"sync_started_at" timestamp with time zone,
	"sync_completed_at" timestamp with time zone,
	"sync_error" text,
	"history_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"gmail_account_id" varchar(21) NOT NULL,
	"type" text DEFAULT 'delete' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"processed_messages" integer DEFAULT 0 NOT NULL,
	"next_page_token" text,
	"last_error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"resumed_at" timestamp with time zone,
	"processed_at_resume" integer,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"gmail_account_id" varchar(21) NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_type" text DEFAULT 'Bearer' NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "senders" (
	"gmail_account_id" varchar(21) NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"count" integer,
	"total_size" bigint
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"user_id" varchar(21) NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"fingerprint_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip_address" text
);
--> statement-breakpoint
CREATE TABLE "unsubscribed_senders" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"gmail_account_id" varchar(21) NOT NULL,
	"sender_email" text NOT NULL,
	"sender_name" text,
	"unsubscribed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"picture" text,
	"google_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_gmail_account_id_gmail_accounts_id_fk" FOREIGN KEY ("gmail_account_id") REFERENCES "public"."gmail_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_gmail_account_id_gmail_accounts_id_fk" FOREIGN KEY ("gmail_account_id") REFERENCES "public"."gmail_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_gmail_account_id_gmail_accounts_id_fk" FOREIGN KEY ("gmail_account_id") REFERENCES "public"."gmail_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "senders" ADD CONSTRAINT "senders_gmail_account_id_gmail_accounts_id_fk" FOREIGN KEY ("gmail_account_id") REFERENCES "public"."gmail_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unsubscribed_senders" ADD CONSTRAINT "unsubscribed_senders_gmail_account_id_gmail_accounts_id_fk" FOREIGN KEY ("gmail_account_id") REFERENCES "public"."gmail_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "emails_gmail_account_unique" ON "emails" USING btree ("gmail_id","gmail_account_id");--> statement-breakpoint
CREATE INDEX "emails_account_idx" ON "emails" USING btree ("gmail_account_id");--> statement-breakpoint
CREATE INDEX "emails_account_from_idx" ON "emails" USING btree ("gmail_account_id","from_email");--> statement-breakpoint
CREATE INDEX "emails_account_category_idx" ON "emails" USING btree ("gmail_account_id","category");--> statement-breakpoint
CREATE INDEX "emails_account_date_idx" ON "emails" USING btree ("gmail_account_id","internal_date");--> statement-breakpoint
CREATE INDEX "emails_account_size_idx" ON "emails" USING btree ("gmail_account_id","size_bytes");--> statement-breakpoint
CREATE INDEX "emails_account_unread_idx" ON "emails" USING btree ("gmail_account_id","is_unread");--> statement-breakpoint
CREATE INDEX "emails_account_starred_idx" ON "emails" USING btree ("gmail_account_id","is_starred");--> statement-breakpoint
CREATE INDEX "emails_account_trash_idx" ON "emails" USING btree ("gmail_account_id","is_trash");--> statement-breakpoint
CREATE INDEX "emails_account_spam_idx" ON "emails" USING btree ("gmail_account_id","is_spam");--> statement-breakpoint
CREATE INDEX "emails_account_important_idx" ON "emails" USING btree ("gmail_account_id","is_important");--> statement-breakpoint
CREATE INDEX "gmail_accounts_user_id_idx" ON "gmail_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gmail_accounts_email_idx" ON "gmail_accounts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "gmail_accounts_sync_status_idx" ON "gmail_accounts" USING btree ("sync_status");--> statement-breakpoint
CREATE UNIQUE INDEX "gmail_accounts_user_email_unique" ON "gmail_accounts" USING btree ("user_id","email");--> statement-breakpoint
CREATE INDEX "jobs_user_id_idx" ON "jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "jobs_gmail_account_idx" ON "jobs" USING btree ("gmail_account_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_type_idx" ON "jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "jobs_user_status_idx" ON "jobs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "jobs_account_type_status_idx" ON "jobs" USING btree ("gmail_account_id","type","status");--> statement-breakpoint
CREATE INDEX "jobs_created_at_idx" ON "jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "oauth_tokens_gmail_account_idx" ON "oauth_tokens" USING btree ("gmail_account_id");--> statement-breakpoint
CREATE INDEX "oauth_tokens_expires_at_idx" ON "oauth_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "senders_account_email_unique" ON "senders" USING btree ("gmail_account_id","email");--> statement-breakpoint
CREATE INDEX "senders_account_idx" ON "senders" USING btree ("gmail_account_id");--> statement-breakpoint
CREATE INDEX "senders_account_count_idx" ON "senders" USING btree ("gmail_account_id","count");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "unsubscribed_senders_gmail_account_idx" ON "unsubscribed_senders" USING btree ("gmail_account_id");--> statement-breakpoint
CREATE INDEX "unsubscribed_senders_email_idx" ON "unsubscribed_senders" USING btree ("sender_email");--> statement-breakpoint
CREATE UNIQUE INDEX "unsubscribed_senders_account_email_unique" ON "unsubscribed_senders" USING btree ("gmail_account_id","sender_email");--> statement-breakpoint
CREATE INDEX "users_google_id_idx" ON "users" USING btree ("google_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");