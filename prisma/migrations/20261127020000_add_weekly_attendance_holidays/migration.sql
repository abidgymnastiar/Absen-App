CREATE TABLE `attendance_holiday_schedules` (
    `data_group_id` BIGINT NOT NULL,
    `employee_id` VARCHAR(50) NOT NULL,
    `weekday` TINYINT UNSIGNED NOT NULL,

    PRIMARY KEY (`data_group_id`, `employee_id`),
    CONSTRAINT `attendance_holiday_schedules_data_group_id_fkey`
        FOREIGN KEY (`data_group_id`) REFERENCES `data_groups`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
