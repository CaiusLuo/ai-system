package com.caius.agent.module.storage.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Bucket 类型枚举
 * 用于区分不同业务用途的对象存储桶
 */
@Getter
@AllArgsConstructor
public enum BucketType {

    /**
     * 用户头像
     */
    AVATAR("avatar", "用户头像存储"),

    /**
     * 文档文件（PDF、简历、附件等）
     */
    DOCUMENT("document", "文档文件存储");

    /**
     * Bucket 配置 key
     */
    private final String configKey;

    /**
     * 描述
     */
    private final String description;

    /**
     * 根据配置 key 获取枚举
     */
    public static BucketType fromConfigKey(String configKey) {
        for (BucketType type : values()) {
            if (type.getConfigKey().equals(configKey)) {
                return type;
            }
        }
        throw new IllegalArgumentException("未知的 BucketType: " + configKey);
    }
}
