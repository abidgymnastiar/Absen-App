-- CreateTable
CREATE TABLE `data_groups` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `group_name` VARCHAR(150) NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `data_group_id` BIGINT NOT NULL,
    `site` VARCHAR(150) NULL,
    `department` VARCHAR(100) NULL,
    `employee_id` VARCHAR(50) NULL,
    `employee_name` VARCHAR(150) NULL,
    `position` VARCHAR(150) NULL,
    `attendance_type` VARCHAR(50) NULL,
    `attendance_date` DATE NULL,
    `scan_time` TIME(0) NULL,
    `shift_code` VARCHAR(100) NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_attendance_group`(`data_group_id`),
    INDEX `idx_attendance_employee_date`(`employee_id`, `attendance_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attendance_logs` ADD CONSTRAINT `attendance_logs_data_group_id_fkey` FOREIGN KEY (`data_group_id`) REFERENCES `data_groups`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

