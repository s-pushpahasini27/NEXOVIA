CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`source_id` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	UNIQUE(`user_id`,`kind`,`source_id`)
);
CREATE INDEX `idx_notifications_user_created` ON `notifications` (`user_id`,`created`);
CREATE INDEX `idx_notifications_user_read` ON `notifications` (`user_id`,`read`);
