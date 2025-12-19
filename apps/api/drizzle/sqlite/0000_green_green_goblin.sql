CREATE TABLE `app_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`is_encrypted` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `emails` (
	`message_id` text NOT NULL,
	`mail_account_id` text NOT NULL,
	`thread_id` text,
	`subject` text,
	`snippet` text,
	`from_email` text NOT NULL,
	`from_name` text,
	`labels` text,
	`category` text,
	`size_bytes` integer,
	`has_attachments` integer DEFAULT 0,
	`is_unread` integer DEFAULT 0,
	`is_starred` integer DEFAULT 0,
	`is_trash` integer DEFAULT 0,
	`is_spam` integer DEFAULT 0,
	`is_important` integer DEFAULT 0,
	`internal_date` integer,
	`synced_at` integer,
	`unsubscribe_link` text,
	FOREIGN KEY (`mail_account_id`) REFERENCES `mail_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emails_message_account_unique` ON `emails` (`message_id`,`mail_account_id`);--> statement-breakpoint
CREATE INDEX `emails_account_idx` ON `emails` (`mail_account_id`);--> statement-breakpoint
CREATE INDEX `emails_account_from_idx` ON `emails` (`mail_account_id`,`from_email`);--> statement-breakpoint
CREATE INDEX `emails_account_category_idx` ON `emails` (`mail_account_id`,`category`);--> statement-breakpoint
CREATE INDEX `emails_account_date_idx` ON `emails` (`mail_account_id`,`internal_date`);--> statement-breakpoint
CREATE INDEX `emails_account_size_idx` ON `emails` (`mail_account_id`,`size_bytes`);--> statement-breakpoint
CREATE INDEX `emails_account_unread_idx` ON `emails` (`mail_account_id`,`is_unread`);--> statement-breakpoint
CREATE INDEX `emails_account_starred_idx` ON `emails` (`mail_account_id`,`is_starred`);--> statement-breakpoint
CREATE INDEX `emails_account_trash_idx` ON `emails` (`mail_account_id`,`is_trash`);--> statement-breakpoint
CREATE INDEX `emails_account_spam_idx` ON `emails` (`mail_account_id`,`is_spam`);--> statement-breakpoint
CREATE INDEX `emails_account_important_idx` ON `emails` (`mail_account_id`,`is_important`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mail_account_id` text NOT NULL,
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
	FOREIGN KEY (`mail_account_id`) REFERENCES `mail_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jobs_user_id_idx` ON `jobs` (`user_id`);--> statement-breakpoint
CREATE INDEX `jobs_mail_account_idx` ON `jobs` (`mail_account_id`);--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `jobs_type_idx` ON `jobs` (`type`);--> statement-breakpoint
CREATE INDEX `jobs_user_status_idx` ON `jobs` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `jobs_account_type_status_idx` ON `jobs` (`mail_account_id`,`type`,`status`);--> statement-breakpoint
CREATE INDEX `jobs_created_at_idx` ON `jobs` (`created_at`);--> statement-breakpoint
CREATE TABLE `mail_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text DEFAULT 'gmail' NOT NULL,
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
CREATE INDEX `mail_accounts_user_id_idx` ON `mail_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `mail_accounts_provider_idx` ON `mail_accounts` (`provider`);--> statement-breakpoint
CREATE INDEX `mail_accounts_email_idx` ON `mail_accounts` (`email`);--> statement-breakpoint
CREATE INDEX `mail_accounts_sync_status_idx` ON `mail_accounts` (`sync_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `mail_accounts_user_provider_email_unique` ON `mail_accounts` (`user_id`,`provider`,`email`);--> statement-breakpoint
CREATE TABLE `mail_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`mail_account_id` text NOT NULL,
	`provider_rule_id` text,
	`name` text NOT NULL,
	`is_enabled` integer DEFAULT 1 NOT NULL,
	`sequence` integer,
	`criteria` text NOT NULL,
	`actions` text NOT NULL,
	`match_sender` text,
	`match_subject` text,
	`synced_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`mail_account_id`) REFERENCES `mail_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mail_rules_account_idx` ON `mail_rules` (`mail_account_id`);--> statement-breakpoint
CREATE INDEX `mail_rules_provider_rule_idx` ON `mail_rules` (`provider_rule_id`);--> statement-breakpoint
CREATE INDEX `mail_rules_enabled_idx` ON `mail_rules` (`mail_account_id`,`is_enabled`);--> statement-breakpoint
CREATE INDEX `mail_rules_sender_idx` ON `mail_rules` (`mail_account_id`,`match_sender`);--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`mail_account_id` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`token_type` text DEFAULT 'Bearer' NOT NULL,
	`scope` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`mail_account_id`) REFERENCES `mail_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_tokens_mail_account_idx` ON `oauth_tokens` (`mail_account_id`);--> statement-breakpoint
CREATE INDEX `oauth_tokens_expires_at_idx` ON `oauth_tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE `senders` (
	`mail_account_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`count` integer,
	`total_size` integer,
	FOREIGN KEY (`mail_account_id`) REFERENCES `mail_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `senders_account_email_unique` ON `senders` (`mail_account_id`,`email`);--> statement-breakpoint
CREATE INDEX `senders_account_idx` ON `senders` (`mail_account_id`);--> statement-breakpoint
CREATE INDEX `senders_account_count_idx` ON `senders` (`mail_account_id`,`count`);--> statement-breakpoint
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
	`mail_account_id` text NOT NULL,
	`sender_email` text NOT NULL,
	`sender_name` text,
	`unsubscribed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`mail_account_id`) REFERENCES `mail_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `unsubscribed_senders_mail_account_idx` ON `unsubscribed_senders` (`mail_account_id`);--> statement-breakpoint
CREATE INDEX `unsubscribed_senders_email_idx` ON `unsubscribed_senders` (`sender_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `unsubscribed_senders_account_email_unique` ON `unsubscribed_senders` (`mail_account_id`,`sender_email`);--> statement-breakpoint
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