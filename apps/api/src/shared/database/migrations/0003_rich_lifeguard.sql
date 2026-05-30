CREATE TABLE IF NOT EXISTS `document_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`user_id` text NOT NULL,
	`payload` text NOT NULL,
	`rejection_reason` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `council_signatories` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`id_number` text DEFAULT '' NOT NULL,
	`signature_image` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `council_signatories_role_unique` ON `council_signatories` (`role`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_document_certifications` (
	`id` text PRIMARY KEY NOT NULL,
	`document_type` text NOT NULL,
	`citizen_id` text,
	`hash` text NOT NULL,
	`issued_at` text,
	`issued_by` text,
	`status` text DEFAULT 'VALID' NOT NULL,
	FOREIGN KEY (`citizen_id`) REFERENCES `citizens`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`issued_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_document_certifications`("id", "document_type", "citizen_id", "hash", "issued_at", "issued_by", "status") SELECT "id", "document_type", "citizen_id", "hash", "issued_at", "issued_by", "status" FROM `document_certifications`;--> statement-breakpoint
DROP TABLE `document_certifications`;--> statement-breakpoint
ALTER TABLE `__new_document_certifications` RENAME TO `document_certifications`;--> statement-breakpoint
PRAGMA foreign_keys=ON;