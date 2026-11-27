ALTER TABLE `attendance_corrections`
    ADD COLUMN `status` ENUM('L', 'I', 'H', 'OFF') NULL;

UPDATE `attendance_corrections` SET `status` = IF(`present`, 'H', 'OFF');

ALTER TABLE `attendance_corrections`
    MODIFY `status` ENUM('L', 'I', 'H', 'OFF') NOT NULL,
    DROP COLUMN `present`;
