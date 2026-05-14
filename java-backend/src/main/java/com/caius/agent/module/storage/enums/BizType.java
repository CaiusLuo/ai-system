package com.caius.agent.module.storage.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 业务类型枚举
 * 用于 objectKey 生成时的 bizType 标识
 */
@Getter
@AllArgsConstructor
public enum BizType {

    /**
     * 头像
     */
    AVATAR("avatar"),

    /**
     * 简历
     */
    RESUME("resume"),

    /**
     * 聊天文件
     */
    CHAT_FILE("chat-file"),

    /**
     * 知识库源文件
     */
    KB_SOURCE("kb-source"),

    /**
     * 通用文档
     */
    DOCUMENT("document");

    /**
     * 业务类型标识
     */
    private final String code;

    /**
     * 根据 code 获取枚举
     */
    public static BizType fromCode(String code) {
        for (BizType type : values()) {
            if (type.getCode().equals(code)) {
                return type;
            }
        }
        throw new IllegalArgumentException("未知的 BizType: " + code);
    }
}
