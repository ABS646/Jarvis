CREATE TABLE `environment_secrets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`encryptedValue` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `environment_secrets_id` PRIMARY KEY(`id`),
	CONSTRAINT `environment_secrets_user_name_unique` UNIQUE(`userId`,`name`)
);
