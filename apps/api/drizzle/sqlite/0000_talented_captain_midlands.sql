CREATE TABLE `gmail_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gmail_accounts_email_unique` ON `gmail_accounts` (`email`);--> statement-breakpoint
CREATE INDEX `gmail_accounts_email_idx` ON `gmail_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`gmail_account_id` text NOT NULL,
	`type` text DEFAULT 'delete' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`query` text NOT NULL,
	`label_ids` text DEFAULT '[]',
	`total_messages` integer DEFAULT 0 NOT NULL,
	`processed_messages` integer DEFAULT 0 NOT NULL,
	`failed_messages` integer DEFAULT 0 NOT NULL,
	`next_page_token` text,
	`last_error` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`started_at` text,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`gmail_account_id`) REFERENCES `gmail_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jobs_gmail_account_idx` ON `jobs` (`gmail_account_id`);--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
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
CREATE INDEX `oauth_tokens_expires_at_idx` ON `oauth_tokens` (`expires_at`);