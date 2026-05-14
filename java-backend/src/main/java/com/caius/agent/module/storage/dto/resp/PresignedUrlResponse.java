package com.caius.agent.module.storage.dto.resp;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 预签名 URL 响应对象
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PresignedUrlResponse {

    /**
     * 预签名 URL
     */
    private String presignedUrl;

    /**
     * 对象 Key（存储路径）
     */
    private String objectKey;

    /**
     * Bucket 名称
     */
    private String bucket;

    /**
     * URL 过期时间（分钟）
     */
    private int expireMinutes;

    /**
     * HTTP 方法（PUT / GET）
     */
    private String method;
}
