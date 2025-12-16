CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`organizationId` int,
	`projectId` int,
	`action` varchar(255) NOT NULL,
	`resourceType` varchar(100) NOT NULL,
	`resourceId` int,
	`metadata` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billingEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`organizationId` int NOT NULL,
	`eventType` enum('api_call','storage_write','storage_read','bandwidth_out','edge_function_invocation','realtime_connection') NOT NULL,
	`quantity` bigint NOT NULL,
	`cost` decimal(10,4),
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billingEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `edgeFunctionLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`functionId` int NOT NULL,
	`projectId` int NOT NULL,
	`level` enum('info','warn','error','debug') NOT NULL,
	`message` text NOT NULL,
	`metadata` json,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `edgeFunctionLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `edgeFunctions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`status` enum('active','inactive','deploying','failed') NOT NULL DEFAULT 'inactive',
	`version` int NOT NULL DEFAULT 1,
	`importMapUrl` text,
	`entrypoint` text NOT NULL,
	`verifyJwt` boolean NOT NULL DEFAULT true,
	`envVars` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deployedAt` timestamp,
	CONSTRAINT `edgeFunctions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizationMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','member') NOT NULL,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organizationMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`ownerUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `planLimits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planType` enum('free','pro','enterprise') NOT NULL,
	`maxProjects` int NOT NULL,
	`maxDatabaseSizeMb` int NOT NULL,
	`maxStorageGb` int NOT NULL,
	`maxBandwidthGb` int NOT NULL,
	`maxApiCallsPerMonth` bigint NOT NULL,
	`maxEdgeFunctions` int NOT NULL,
	`maxRealtimeConnections` int NOT NULL,
	`customDomain` boolean NOT NULL DEFAULT false,
	`prioritySupport` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `planLimits_id` PRIMARY KEY(`id`),
	CONSTRAINT `planLimits_planType_unique` UNIQUE(`planType`)
);
--> statement-breakpoint
CREATE TABLE `projectCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`jwtSecret` varchar(255) NOT NULL,
	`anonKey` text NOT NULL,
	`serviceKey` text NOT NULL,
	`dbUsername` varchar(255) NOT NULL,
	`dbPassword` varchar(255) NOT NULL,
	`storageBucket` varchar(255) NOT NULL,
	`postgresConnectionString` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `projectCredentials_projectId_unique` UNIQUE(`projectId`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`organizationId` int NOT NULL,
	`databaseName` varchar(255) NOT NULL,
	`databaseHost` varchar(255),
	`databasePort` int DEFAULT 5432,
	`region` varchar(50) DEFAULT 'us-west-1',
	`status` enum('active','paused','provisioning','deleting','deleted') NOT NULL DEFAULT 'provisioning',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`pausedAt` timestamp,
	`deletedAt` timestamp,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `projects_databaseName_unique` UNIQUE(`databaseName`)
);
--> statement-breakpoint
CREATE TABLE `realtimeChannels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('broadcast','presence','postgres_changes') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`schema` varchar(255),
	`table` varchar(255),
	`filter` text,
	`config` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `realtimeChannels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`planType` enum('free','pro','enterprise') NOT NULL DEFAULT 'free',
	`status` enum('active','cancelled','expired','past_due') NOT NULL DEFAULT 'active',
	`billingCycle` enum('monthly','yearly') NOT NULL DEFAULT 'monthly',
	`currentPeriodStart` timestamp NOT NULL,
	`currentPeriodEnd` timestamp NOT NULL,
	`stripeCustomerId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`cancelledAt` timestamp,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_organizationId_unique` UNIQUE(`organizationId`)
);
--> statement-breakpoint
CREATE TABLE `usageMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`metricType` enum('database_size_mb','api_calls','storage_bytes','bandwidth_bytes','edge_function_invocations','realtime_connections') NOT NULL,
	`value` bigint NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`granularity` enum('hourly','daily','weekly','monthly') NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usageMetrics_id` PRIMARY KEY(`id`)
);
