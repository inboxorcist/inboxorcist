CREATE TABLE `app_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`is_encrypted` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gmail_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`sync_status` text DEFAULT 'idle' NOT NULL,
	`sync_started_at` text,
	`sync_completed_at` text,
	`sync_error` text,
	`history_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `gmail_accounts_user_id_idx` ON `gmail_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `gmail_accounts_email_idx` ON `gmail_accounts` (`email`);--> statement-breakpoint
CREATE INDEX `gmail_accounts_sync_status_idx` ON `gmail_accounts` (`sync_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `gmail_accounts_user_email_unique` ON `gmail_accounts` (`user_id`,`email`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`gmail_account_id` text NOT NULL,
	`type` text DEFAULT 'delete' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_messages` integer DEFAULT 0 NOT NULL,
	`processed_messages` integer DEFAULT 0 NOT NULL,
	`next_page_token` text,
	`last_error` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`resumed_at` text,
	`processed_at_resume` integer,
	`started_at` text,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`gmail_account_id`) REFERENCES `gmail_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jobs_user_id_idx` ON `jobs` (`user_id`);--> statement-breakpoint
CREATE INDEX `jobs_gmail_account_idx` ON `jobs` (`gmail_account_id`);--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `jobs_type_idx` ON `jobs` (`type`);--> statement-breakpoint
CREATE INDEX `jobs_user_status_idx` ON `jobs` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `jobs_account_type_status_idx` ON `jobs` (`gmail_account_id`,`type`,`status`);--> statement-breakpoint
CREATE INDEX `jobs_created_at_idx` ON `jobs` (`created_at`);--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`gmail_account_id` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`token_type` text DEFAULT 'Bearer' NOT NULL,
	`scope` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`gmail_account_id`) REFERENCES `gmail_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_tokens_gmail_account_idx` ON `oauth_tokens` (`gmail_account_id`);--> statement-breakpoint
CREATE INDEX `oauth_tokens_expires_at_idx` ON `oauth_tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`refresh_token_hash` text NOT NULL,
	`fingerprint_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`absolute_expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_used_at` text DEFAULT (datetime('now')) NOT NULL,
	`revoked_at` text,
	`user_agent` text,
	`ip_address` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_token_hash_idx` ON `sessions` (`refresh_token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `unsubscribed_senders` (
	`id` text PRIMARY KEY NOT NULL,
	`gmail_account_id` text NOT NULL,
	`sender_email` text NOT NULL,
	`sender_name` text,
	`unsubscribed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`gmail_account_id`) REFERENCES `gmail_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `unsubscribed_senders_gmail_account_idx` ON `unsubscribed_senders` (`gmail_account_id`);--> statement-breakpoint
CREATE INDEX `unsubscribed_senders_email_idx` ON `unsubscribed_senders` (`sender_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `unsubscribed_senders_account_email_unique` ON `unsubscribed_senders` (`gmail_account_id`,`sender_email`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`picture` text,
	`google_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);--> statement-breakpoint
CREATE INDEX `users_google_id_idx` ON `users` (`google_id`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);