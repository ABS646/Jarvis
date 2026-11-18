CREATE TABLE `background_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`kind` varchar(64) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'queued',
	`payload` text NOT NULL,
	`idempotencyKey` varchar(191) NOT NULL,
	`runAfter` timestamp NOT NULL DEFAULT (now()),
	`attempts` int NOT NULL DEFAULT 0,
	`lockedAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `background_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `background_jobs_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `service_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(32) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'ready',
	`accountId` varchar(191),
	`accountLabel` text,
	`scopes` text,
	`encryptedAccessToken` text,
	`encryptedRefreshToken` text,
	`expiresAt` timestamp,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastUsedAt` timestamp,
	CONSTRAINT `service_connections_id` PRIMARY KEY(`id`)
);
