CREATE TABLE `attendance_overtimes` (
    `data_group_id` BIGINT NOT NULL,
    `employee_id` VARCHAR(50) NOT NULL,
    `attendance_date` DATE NOT NULL,
    `overtime_type` ENUM('L', 'LB') NOT NULL,
    `minutes` SMALLINT UNSIGNED NOT NULL,

    PRIMARY KEY (`data_group_id`, `employee_id`, `attendance_date`, `overtime_type`),
    CONSTRAINT `attendance_overtimes_data_group_id_fkey`
        FOREIGN KEY (`data_group_id`) REFERENCES `data_groups`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
