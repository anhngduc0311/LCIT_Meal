-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Sep 23, 2026 at 03:09 AM
-- Server version: 10.4.28-MariaDB
-- PHP Version: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `qlsa`
--

-- --------------------------------------------------------

--
-- Table structure for table `audit_log`
--

CREATE TABLE `audit_log` (
  `id` int(10) UNSIGNED NOT NULL,
  `log_actor` int(11) UNSIGNED DEFAULT NULL,
  `log_action` varchar(100) NOT NULL,
  `log_target` varchar(150) DEFAULT NULL,
  `log_result` varchar(50) DEFAULT NULL,
  `log_detail` text DEFAULT NULL,
  `log_time` datetime NOT NULL DEFAULT current_timestamp(),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'success',
  `old_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_data`)),
  `new_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_data`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `meal`
--

CREATE TABLE `meal` (
  `id` int(10) UNSIGNED NOT NULL,
  `meal_date` date NOT NULL,
  `is_cancelled` tinyint(1) NOT NULL DEFAULT 0,
  `cancelled_by` int(11) UNSIGNED DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `meal_option`
--

CREATE TABLE `meal_option` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(11) UNSIGNED NOT NULL,
  `type` varchar(50) NOT NULL,
  `from_date` date NOT NULL,
  `to_date` date NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) UNSIGNED DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  `updated_by` int(11) UNSIGNED DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `approved_by` int(11) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `meal_registration`
--

CREATE TABLE `meal_registration` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(11) UNSIGNED NOT NULL,
  `meal_id` int(11) UNSIGNED NOT NULL,
  `guest_count` int(11) NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `migration`
--

CREATE TABLE `migration` (
  `version` varchar(180) NOT NULL,
  `apply_time` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notification`
--

CREATE TABLE `notification` (
  `id` int(10) UNSIGNED NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text DEFAULT NULL,
  `url` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) UNSIGNED DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  `updated_by` int(11) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notification_recipient`
--

CREATE TABLE `notification_recipient` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(11) UNSIGNED NOT NULL,
  `notification_id` int(11) UNSIGNED NOT NULL,
  `is_seen` tinyint(1) NOT NULL DEFAULT 0,
  `seen_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment`
--

CREATE TABLE `payment` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(11) UNSIGNED NOT NULL,
  `payment_date` date NOT NULL,
  `amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `is_paid` tinyint(1) NOT NULL DEFAULT 0,
  `paid_at` datetime DEFAULT NULL,
  `paid_amount` decimal(14,2) DEFAULT NULL,
  `bill_img` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'unpaid'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `role`
--

CREATE TABLE `role` (
  `id` int(10) UNSIGNED NOT NULL,
  `display_name` varchar(150) NOT NULL,
  `code` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) UNSIGNED DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  `updated_by` int(11) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `system_setting`
--

CREATE TABLE `system_setting` (
  `id` int(10) UNSIGNED NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` varchar(255) DEFAULT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `data_type` varchar(20) NOT NULL DEFAULT 'string',
  `description` varchar(255) DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  `updated_by` int(11) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `id` int(10) UNSIGNED NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `phone` varchar(32) DEFAULT NULL,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `auth_key` varchar(32) NOT NULL,
  `access_token` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) UNSIGNED DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  `updated_by` int(11) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Table structure for table `user_role`
--

CREATE TABLE `user_role` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(11) UNSIGNED NOT NULL,
  `role_id` int(11) UNSIGNED NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) UNSIGNED DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  `updated_by` int(11) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


--
-- Dumping data for table `role`
--

INSERT INTO `role` (`id`, `display_name`, `code`, `description`, `status`, `created_at`, `created_by`, `updated_at`, `updated_by`) VALUES
(1, 'Quản trị viên', 'admin', 'Toàn quyền quản trị hệ thống, cấu hình, phân quyền', 'active', '2026-01-01 08:00:00', NULL, NULL, NULL),
(2, 'Quản lý bếp ăn', 'manager', 'Duyệt đăng ký/hủy đột xuất, xem báo cáo, quản lý thanh toán', 'active', '2026-01-01 08:00:00', 1, NULL, NULL),
(3, 'Nhân viên', 'employee', 'Đăng ký ăn, đăng ký đột xuất, xem lịch sử thanh toán của bản thân', 'active', '2026-01-01 08:00:00', 1, NULL, NULL);

--
-- Dumping data for table `system_setting`
--

INSERT INTO `system_setting` (`id`, `setting_key`, `setting_value`, `display_name`, `data_type`, `description`, `updated_at`, `updated_by`) VALUES
(1, 'registration_close_time', '08:00', 'Thời gian đóng đăng ký', 'string', 'Giờ đóng đăng ký/hủy suất ăn trong ngày (HH:mm)', '2026-01-01 08:00:00', 1),
(2, 'meal_price', '35000', 'Giá tiền', 'integer', 'Đơn giá một suất ăn (VNĐ)', '2026-01-01 08:00:00', 1),
(3, 'guest_meal_price', '40000', 'Giá tiền (khách)', 'integer', 'Đơn giá một suất ăn khách mời (VNĐ)', '2026-01-01 08:00:00', 1),
(4, 'auto_register_enabled', '1', 'Tự động đăng ký', 'boolean', 'Bật/tắt tự động đăng ký ăn theo lịch mặc định', '2026-01-01 08:00:00', 1),
(5, 'max_guest_per_registration', '3', 'Số lượng khách tối đa', 'integer', 'Số lượng khách tối đa được đăng ký kèm trong một lượt', '2026-01-01 08:00:00', 1),
(6, 'auto_register_start_day', '1', 'Ngày bắt đầu tự động đăng ký', 'integer', 'Ngày trong tháng bắt đầu tạo lịch và đăng ký suất ăn cho cả tháng.', NULL, NULL),
(7, 'payment_due_day', '10', 'Ngày đến hạn thanh toán', 'integer', 'Ngày trong tháng bắt đầu nhắc thanh toán.', NULL, NULL),
(8, 'payment_reminder_enabled', '1', 'Nhắc thanh toán', 'boolean', 'Gửi thông báo khi đến hạn và nhắc hằng ngày.', NULL, NULL),
(9, 'payment_qr_image', '', 'QR thanh toán', 'string', 'Đường dẫn ảnh QR thanh toán.', NULL, NULL),
(10, 'meal_completion_time', '12:00', 'Giờ cập nhật hoàn thành suất ăn', 'string', 'Giờ (HH:mm) hệ thống tự động chuyển các suất ăn đã đăng ký (confirmed) đã qua bữa sang trạng thái đã hoàn thành (completed).', NULL, NULL);

--
-- Dumping data for table `user`
--

INSERT INTO `user` (`id`, `full_name`, `username`, `password_hash`, `auth_key`, `access_token`, `status`, `created_at`, `created_by`, `updated_at`, `updated_by`) VALUES
(1, 'Nguyễn Văn Admin', 'admin', '$2b$10$2t/J6jU/zwE/hmw2aCRKD.ptFGbpMBgt59ORwwH01LVF9fBmkf8Ve', '', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsImlhdCI6MTc5MDA2NTQ5NywiZXhwIjoxNzkwNjcwMjk3fQ.mk2tuofylB34HbPOdSe85Phb_l-qJOJogc8tsmdqCiA', '1', '2026-01-01 08:00:00', NULL, '2026-09-22 15:24:57', NULL);

--
-- Dumping data for table `user_role`
--

INSERT INTO `user_role` (`id`, `user_id`, `role_id`, `status`, `created_at`, `created_by`, `updated_at`, `updated_by`) VALUES
(1, 1, 1, 'active', '2026-01-01 08:00:00', 1, NULL, NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `audit_log`
--
ALTER TABLE `audit_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx-audit_log-log_actor` (`log_actor`);

--
-- Indexes for table `meal`
--
ALTER TABLE `meal`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_meal_date` (`meal_date`);

--
-- Indexes for table `meal_option`
--
ALTER TABLE `meal_option`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx-meal_option-user_id` (`user_id`);

--
-- Indexes for table `meal_registration`
--
ALTER TABLE `meal_registration`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_meal_registration_user_meal` (`user_id`,`meal_id`),
  ADD KEY `idx-meal_registration-user_id` (`user_id`),
  ADD KEY `idx-meal_registration-meal_id` (`meal_id`);

--
-- Indexes for table `migration`
--
ALTER TABLE `migration`
  ADD PRIMARY KEY (`version`);

--
-- Indexes for table `notification`
--
ALTER TABLE `notification`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `notification_recipient`
--
ALTER TABLE `notification_recipient`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx-notification_recipient-user_id` (`user_id`),
  ADD KEY `idx-notification_recipient-notification_id` (`notification_id`);

--
-- Indexes for table `payment`
--
ALTER TABLE `payment`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx-payment-user_id` (`user_id`);

--
-- Indexes for table `role`
--
ALTER TABLE `role`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_role_code` (`code`);

--
-- Indexes for table `system_setting`
--
ALTER TABLE `system_setting`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_system_setting_key` (`setting_key`);

--
-- Indexes for table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_username` (`username`),
  ADD UNIQUE KEY `uq_user_access_token` (`access_token`);

--
-- Indexes for table `user_role`
--
ALTER TABLE `user_role`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_role` (`user_id`,`role_id`),
  ADD KEY `idx-user_role-user_id` (`user_id`),
  ADD KEY `idx-user_role-role_id` (`role_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `audit_log`
--
ALTER TABLE `audit_log`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `meal`
--
ALTER TABLE `meal`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

--
-- AUTO_INCREMENT for table `meal_option`
--
ALTER TABLE `meal_option`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `meal_registration`
--
ALTER TABLE `meal_registration`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

--
-- AUTO_INCREMENT for table `notification`
--
ALTER TABLE `notification`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `notification_recipient`
--
ALTER TABLE `notification_recipient`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `payment`
--
ALTER TABLE `payment`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `role`
--
ALTER TABLE `role`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `system_setting`
--
ALTER TABLE `system_setting`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=81;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `user_role`
--
ALTER TABLE `user_role`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `audit_log`
--
ALTER TABLE `audit_log`
  ADD CONSTRAINT `fk_audit_log_user` FOREIGN KEY (`log_actor`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `meal_option`
--
ALTER TABLE `meal_option`
  ADD CONSTRAINT `fk_meal_option_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `meal_registration`
--
ALTER TABLE `meal_registration`
  ADD CONSTRAINT `fk_meal_registration_meal` FOREIGN KEY (`meal_id`) REFERENCES `meal` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_meal_registration_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `notification_recipient`
--
ALTER TABLE `notification_recipient`
  ADD CONSTRAINT `fk_notif_recipient_notification` FOREIGN KEY (`notification_id`) REFERENCES `notification` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notif_recipient_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `payment`
--
ALTER TABLE `payment`
  ADD CONSTRAINT `fk_payment_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `user_role`
--
ALTER TABLE `user_role`
  ADD CONSTRAINT `fk_user_role_role` FOREIGN KEY (`role_id`) REFERENCES `role` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_user_role_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Migration: Cấu hình ngày ăn trong tuần
-- Mục đích: Cho phép admin cấu hình ngày nào trong tuần có suất ăn.
-- 0=CN, 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7
--

-- 1. Tạo bảng cấu hình ngày ăn
-- updated_by dùng INT UNSIGNED để tương thích với user.id.
CREATE TABLE IF NOT EXISTS `meal_schedule_config` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `day_of_week` TINYINT UNSIGNED NOT NULL,
  `is_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` VARCHAR(255) NULL,
  `updated_by` INT UNSIGNED NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_meal_schedule_day_of_week` (`day_of_week`),
  KEY `idx_meal_schedule_updated_by` (`updated_by`),
  CONSTRAINT `fk_meal_schedule_updated_by`
    FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `chk_meal_schedule_day_of_week`
    CHECK (`day_of_week` BETWEEN 0 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Cấu hình ngày ăn trong tuần (nào có bếp, nào không)';

-- 2. Dữ liệu mặc định: T2-T6 có ăn, T7-CN không ăn
INSERT INTO `meal_schedule_config` (`day_of_week`, `is_enabled`, `notes`) VALUES
(0, 0, 'Chủ nhật - không có suất ăn'),
(1, 1, 'Thứ 2'),
(2, 1, 'Thứ 3'),
(3, 1, 'Thứ 4'),
(4, 1, 'Thứ 5'),
(5, 1, 'Thứ 6'),
(6, 0, 'Thứ 7 - không có suất ăn')
ON DUPLICATE KEY UPDATE
  `is_enabled` = VALUES(`is_enabled`),
  `notes` = VALUES(`notes`);

-- 3. Thêm cột vào system_setting nếu chưa tồn tại.
-- Dùng dynamic SQL để tương thích với MySQL không hỗ trợ
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'system_setting'
    AND COLUMN_NAME = 'auto_schedule_use_meal_config'
);

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE `system_setting` ADD COLUMN `auto_schedule_use_meal_config` TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''1=Dùng cấu hình meal_schedule_config, 0=Tạo cho tất cả ngày''',
  'SELECT 1'
);

PREPARE stmt_add_schedule_config FROM @sql;
EXECUTE stmt_add_schedule_config;
DEALLOCATE PREPARE stmt_add_schedule_config;

-- 4. CÁC QUERY TIỆN ÍCH
-- Các câu dưới đây được để COMMENT để không tự động thay đổi cấu hình
-- khi file qlsa_clean.sql được import.
--
-- Lấy danh sách cấu hình:
-- SELECT
--   `id`,
--   CASE `day_of_week`
--     WHEN 0 THEN 'Chủ nhật (CN)'
--     WHEN 1 THEN 'Thứ 2 (T2)'
--     WHEN 2 THEN 'Thứ 3 (T3)'
--     WHEN 3 THEN 'Thứ 4 (T4)'
--     WHEN 4 THEN 'Thứ 5 (T5)'
--     WHEN 5 THEN 'Thứ 6 (T6)'
--     WHEN 6 THEN 'Thứ 7 (T7)'
--   END AS `day_name`,
--   `day_of_week`,
--   IF(`is_enabled` = 1, 'Có ăn', 'Không ăn') AS `status`,
--   `notes`,
--   `updated_at`
-- FROM `meal_schedule_config`
-- ORDER BY `day_of_week`;
--
-- Bật tất cả các ngày:
-- UPDATE `meal_schedule_config` SET `is_enabled` = 1;
--
-- Tắt T7 và CN:
-- UPDATE `meal_schedule_config` SET `is_enabled` = 0 WHERE `day_of_week` IN (0, 6);
--
-- Tắt CN:
-- UPDATE `meal_schedule_config` SET `is_enabled` = 0 WHERE `day_of_week` = 0;
--
-- Bật CN:
-- UPDATE `meal_schedule_config` SET `is_enabled` = 1 WHERE `day_of_week` = 0;
--
-- Xem các ngày hiện đang có suất ăn:
-- SELECT *
-- FROM `meal_schedule_config`
-- WHERE `is_enabled` = 1
-- ORDER BY `day_of_week`;
--
-- Kiểm tra số ngày ăn trong tuần:
-- SELECT COUNT(*) AS `days_with_meal`
-- FROM `meal_schedule_config`
-- WHERE `is_enabled` = 1;
--
-- Lấy những ngày bị tắt:
-- SELECT
--   CASE `day_of_week`
--     WHEN 0 THEN 'Chủ nhật (CN)'
--     WHEN 1 THEN 'Thứ 2 (T2)'
--     WHEN 2 THEN 'Thứ 3 (T3)'
--     WHEN 3 THEN 'Thứ 4 (T4)'
--     WHEN 4 THEN 'Thứ 5 (T5)'
--     WHEN 5 THEN 'Thứ 6 (T6)'
--     WHEN 6 THEN 'Thứ 7 (T7)'
--   END AS `day_name`
-- FROM `meal_schedule_config`
-- WHERE `is_enabled` = 0
-- ORDER BY `day_of_week`;


--
-- Bảng holiday_event: Quản lý ngày nghỉ/sự kiện đặc biệt
--
CREATE TABLE IF NOT EXISTS `holiday_event` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL COMMENT 'Tên ngày nghỉ/sự kiện',
  `reason` VARCHAR(500) NULL COMMENT 'Lý do nghỉ',
  `from_date` DATE NOT NULL COMMENT 'Ngày bắt đầu',
  `to_date` DATE NOT NULL COMMENT 'Ngày kết thúc',
  `status` VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT 'Trạng thái: active/inactive',
  `created_by` INT UNSIGNED NULL COMMENT 'Người tạo',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `restored_by` INT UNSIGNED NULL COMMENT 'Người khôi phục/thay đổi trạng thái',
  `restored_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_holiday_event_from_date` (`from_date`),
  KEY `idx_holiday_event_to_date` (`to_date`),
  KEY `idx_holiday_event_status` (`status`),
  KEY `idx_holiday_event_created_by` (`created_by`),
  KEY `idx_holiday_event_restored_by` (`restored_by`),
  CONSTRAINT `fk_holiday_event_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_holiday_event_restored_by` FOREIGN KEY (`restored_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_holiday_event_date_range` CHECK (`to_date` >= `from_date`),
  CONSTRAINT `chk_holiday_event_status` CHECK (`status` IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Quản lý ngày nghỉ/sự kiện đặc biệt';

-- Keep the original state only for rows actually cancelled by a holiday.
CREATE TABLE IF NOT EXISTS holiday_event_meal (
  event_id INT UNSIGNED NOT NULL,
  meal_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (event_id, meal_id),
  FOREIGN KEY (event_id) REFERENCES holiday_event(id) ON DELETE CASCADE,
  FOREIGN KEY (meal_id) REFERENCES meal(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS holiday_event_registration (
  event_id INT UNSIGNED NOT NULL,
  registration_id INT UNSIGNED NOT NULL,
  previous_status VARCHAR(20) NOT NULL,
  PRIMARY KEY (event_id, registration_id),
  FOREIGN KEY (event_id) REFERENCES holiday_event(id) ON DELETE CASCADE,
  FOREIGN KEY (registration_id) REFERENCES meal_registration(id) ON DELETE CASCADE
) ENGINE=InnoDB;


COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
