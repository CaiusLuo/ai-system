-- 简历持久化迁移脚本
USE agent_db;

-- 1. 用户表增加活跃简历 ID
ALTER TABLE `user` ADD COLUMN `active_resume_id` BIGINT DEFAULT NULL COMMENT '当前活跃简历ID' AFTER `avatar_object_key`;

-- 2. 创建用户简历表
CREATE TABLE IF NOT EXISTS `user_resume` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '简历ID',
    `user_id` BIGINT NOT NULL COMMENT '用户ID',
    `file_name` VARCHAR(200) NOT NULL COMMENT '文件名',
    `bucket` VARCHAR(100) NOT NULL COMMENT '存储 bucket',
    `object_key` VARCHAR(512) NOT NULL COMMENT '存储对象 key',
    `file_size` BIGINT NOT NULL COMMENT '文件大小（字节）',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_user_created_at` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户简历表';
