CREATE TABLE `call_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`caller` text NOT NULL,
	`callee` text NOT NULL,
	`status` text NOT NULL,
	`offer` text NOT NULL,
	`answer` text,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
CREATE INDEX `idx_calls_parties_status` ON `call_sessions` (`caller`,`callee`,`status`);

CREATE TABLE `call_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`call_id` text NOT NULL,
	`sender` text NOT NULL,
	`candidate` text NOT NULL,
	`created` text NOT NULL
);
CREATE INDEX `idx_call_candidates_call` ON `call_candidates` (`call_id`,`created`);
