CREATE TABLE `activity_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`kind` varchar(24) NOT NULL,
	`message` text NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approval_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(191) NOT NULL,
	`detail` text NOT NULL,
	`tag` varchar(32) NOT NULL,
	`risk` varchar(24) NOT NULL DEFAULT 'review',
	`status` varchar(24) NOT NULL DEFAULT 'pending',
	`executionStatus` varchar(24) NOT NULL DEFAULT 'not_started',
	`idempotencyKey` varchar(191) NOT NULL,
	`executionError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`decidedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `approval_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `approval_requests_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `workflow_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(191) NOT NULL,
	`detail` text NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'pending',
	`progress` int NOT NULL DEFAULT 0,
	`approvalRequired` int NOT NULL DEFAULT 1,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_tasks_id` PRIMARY KEY(`id`)
);
