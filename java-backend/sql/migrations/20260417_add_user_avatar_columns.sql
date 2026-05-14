ALTER TABLE `user`
    ADD COLUMN IF NOT EXISTS `avatar_bucket` VARCHAR(100) DEFAULT NULL COMMENT '头像存储 bucket' AFTER `password`,
    ADD COLUMN IF NOT EXISTS `avatar_object_key` VARCHAR(512) DEFAULT NULL COMMENT '头像对象 key' AFTER `avatar_bucket`;
