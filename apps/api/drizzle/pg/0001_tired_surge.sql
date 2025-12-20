CREATE TABLE "deleted_emails" (
	"message_id" text NOT NULL,
	"mail_account_id" varchar(21) NOT NULL,
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
	"is_spam" integer DEFAULT 0,
	"is_important" integer DEFAULT 0,
	"internal_date" bigint,
	"unsubscribe_link" text,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deleted_emails" ADD CONSTRAINT "deleted_emails_mail_account_id_mail_accounts_id_fk" FOREIGN KEY ("mail_account_id") REFERENCES "public"."mail_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deleted_emails_message_account_unique" ON "deleted_emails" USING btree ("message_id","mail_account_id");--> statement-breakpoint
CREATE INDEX "deleted_emails_account_idx" ON "deleted_emails" USING btree ("mail_account_id");--> statement-breakpoint
CREATE INDEX "deleted_emails_account_from_idx" ON "deleted_emails" USING btree ("mail_account_id","from_email");--> statement-breakpoint
CREATE INDEX "deleted_emails_account_date_idx" ON "deleted_emails" USING btree ("mail_account_id","internal_date");--> statement-breakpoint
CREATE INDEX "deleted_emails_deleted_at_idx" ON "deleted_emails" USING btree ("mail_account_id","deleted_at");