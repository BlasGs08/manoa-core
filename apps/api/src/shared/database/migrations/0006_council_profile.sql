CREATE TABLE IF NOT EXISTS `council_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Consejo Comunal' NOT NULL,
	`rif` text,
	`address` text,
	`phone` text,
	`email` text,
	`description` text,
	`updated_at` integer DEFAULT (unixepoch())
);
