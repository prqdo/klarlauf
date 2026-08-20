CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client` text NOT NULL,
	`project` text NOT NULL,
	`due` text NOT NULL,
	`value_cents` integer NOT NULL,
	`status` text DEFAULT 'New' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "orders_value_positive" CHECK("orders"."value_cents" > 0),
	CONSTRAINT "orders_status_valid" CHECK("orders"."status" IN ('New', 'In progress', 'Review', 'Ready'))
);
--> statement-breakpoint
CREATE INDEX `idx_orders_status_created` ON `orders` (`status`,`created_at`);
