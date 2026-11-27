CREATE TABLE `payroll_drafts` (
    `data_group_id` BIGINT NOT NULL,
    `config` JSON NOT NULL,
    `version` INT NOT NULL DEFAULT 1,
    PRIMARY KEY (`data_group_id`),
    CONSTRAINT `payroll_drafts_data_group_id_fkey`
        FOREIGN KEY (`data_group_id`) REFERENCES `data_groups`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
