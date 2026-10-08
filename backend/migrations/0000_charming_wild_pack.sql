CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`topic` text NOT NULL,
	`score` integer NOT NULL,
	`total` integer NOT NULL,
	`details` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_attempts_user` ON `attempts` (`user_id`);--> statement-breakpoint
CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_connections_sender` ON `connections` (`sender`);--> statement-breakpoint
CREATE INDEX `idx_connections_recipient` ON `connections` (`recipient`);--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`cards` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_decks_user` ON `decks` (`user_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`body` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_pair` ON `messages` (`sender`,`recipient`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`input` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_plans_user` ON `plans` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`subjects` text DEFAULT '' NOT NULL,
	`goal` integer DEFAULT 600 NOT NULL,
	`discoverable` integer DEFAULT 0 NOT NULL,
	`adaptive` integer DEFAULT 1 NOT NULL,
	`reminders` integer DEFAULT 1 NOT NULL,
	`recovery` text DEFAULT 'suggest' NOT NULL,
	`latitude` real,
	`longitude` real,
	`video` text DEFAULT '' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quiz_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`topic` text NOT NULL,
	`questions` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_quiz_user` ON `quiz_drafts` (`user_id`);--> statement-breakpoint
CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`topic` text NOT NULL,
	`url` text NOT NULL,
	`kind` text NOT NULL,
	`file_key` text,
	`content` text DEFAULT '' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_resources_user` ON `resources` (`user_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`deck_id` text NOT NULL,
	`card` integer NOT NULL,
	`rating` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_user` ON `reviews` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`task_id` text NOT NULL,
	`subject` text NOT NULL,
	`minutes` integer NOT NULL,
	`date` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_date` ON `sessions` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`subject` text NOT NULL,
	`topic` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`duration` integer NOT NULL,
	`priority` text NOT NULL,
	`difficulty` text NOT NULL,
	`deadline` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`kind` text NOT NULL,
	`manual` integer DEFAULT 0 NOT NULL,
	`snooze_until` text
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_user_plan_date` ON `tasks` (`user_id`,`plan_id`,`date`);--> statement-breakpoint
CREATE TABLE `tutor_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`body` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tutor_user` ON `tutor_messages` (`user_id`);