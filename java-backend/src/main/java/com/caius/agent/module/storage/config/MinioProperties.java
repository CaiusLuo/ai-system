package com.caius.agent.module.storage.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.NestedConfigurationProperty;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

/**
 * 对象存储配置类
 * 对应 application.yml 中 storage.minio 配置，环境变量统一走 OSS_*。
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "storage.minio")
public class MinioProperties {

    /**
     * MinIO 服务地址，如 http://127.0.0.1:9000
     */
    private String endpoint;

    /**
     * 是否使用 HTTPS
     */
    private boolean secure = false;

    /**
     * 访问密钥
     */
    private String accessKey;

    /**
     * 密钥密码
     */
    private String secretKey;

    /**
     * Bucket 名称映射，key 为 BucketType.configKey，value 为实际 bucket 名称
     */
    private Map<String, String> buckets;

    /**
     * 预签名 URL 过期时间（分钟）
     */
    private int presignedExpireMinutes = 30;

    /**
     * 对外访问域名（可选）。配置后优先返回公开地址，而不是预签名 URL。
     * 示例：https://cdn.example.com
     */
    private String publicBaseUrl;

    /**
     * 启动时是否自动创建 Bucket
     */
    private boolean autoCreateBuckets = true;

    /**
     * 头像文件最大大小（如 5MB）
     */
    private String maxAvatarSize = "5MB";

    /**
     * 文档文件最大大小（如 20MB）
     */
    private String maxDocumentSize = "20MB";

    /**
     * 文件访问 URL 过期时间（分钟）
     */
    private int urlExpireMinutes = 1440;

    /**
     * 解析文件大小为字节数
     */
    public long getMaxAvatarSizeBytes() {
        return parseSizeToBytes(maxAvatarSize);
    }

    public long getMaxDocumentSizeBytes() {
        return parseSizeToBytes(maxDocumentSize);
    }

    /**
     * 将配置的大小字符串解析为字节数
     * 支持格式：5MB, 20MB, 1GB 等
     */
    private long parseSizeToBytes(String size) {
        if (size == null || size.isBlank()) {
            return 0;
        }
        String trimmed = size.trim().toUpperCase();
        if (trimmed.endsWith("GB")) {
            return Long.parseLong(trimmed.replace("GB", "").trim()) * 1024 * 1024 * 1024;
        } else if (trimmed.endsWith("MB")) {
            return Long.parseLong(trimmed.replace("MB", "").trim()) * 1024 * 1024;
        } else if (trimmed.endsWith("KB")) {
            return Long.parseLong(trimmed.replace("KB", "").trim()) * 1024;
        } else {
            return Long.parseLong(trimmed);
        }
    }
}
