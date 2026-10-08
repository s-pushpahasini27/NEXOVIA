CREATE TABLE `google_identities` (
	`sub` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_google_identities_user` ON `google_identities` (`user_id`);