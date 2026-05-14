package com.caius.agent.module.storage.config;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

/**
 * MinIO 客户端配置类
 * 负责初始化 MinioClient 并自动检查/创建 Bucket
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class MinioConfig {

    private final MinioProperties minioProperties;

    /**
     * 创建 MinioClient Bean
     */
    @Bean
    @Lazy
    public MinioClient minioClient() {
        MinioClient.Builder builder = MinioClient.builder()
                .credentials(minioProperties.getAccessKey(), minioProperties.getSecretKey());

        applyEndpoint(builder);

        MinioClient client = builder.build();

        // 启动时检查并创建 Bucket
        if (minioProperties.isAutoCreateBuckets()) {
            initBuckets(client);
        }

        return client;
    }

    private void applyEndpoint(MinioClient.Builder builder) {
        String endpoint = minioProperties.getEndpoint();
        if (!StringUtils.hasText(endpoint)) {
            throw new IllegalStateException("未配置 OSS endpoint");
        }

        if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
            builder.endpoint(endpoint);
            return;
        }

        if (endpoint.contains(":")) {
            String[] parts = endpoint.split(":", 2);
            try {
                builder.endpoint(parts[0], Integer.parseInt(parts[1]), minioProperties.isSecure());
                return;
            } catch (NumberFormatException ignored) {
                // 回退到 SDK 原生解析，避免误杀域名中包含非法端口的场景。
            }
        }

        builder.endpoint(endpoint, minioProperties.isSecure() ? 443 : 80, minioProperties.isSecure());
    }

    /**
     * 初始化 Bucket：检查是否存在，不存在则创建
     */
    private void initBuckets(MinioClient client) {
        minioProperties.getBuckets().forEach((key, bucketName) -> {
            try {
                boolean exists = client.bucketExists(
                        BucketExistsArgs.builder().bucket(bucketName).build());
                if (!exists) {
                    client.makeBucket(MakeBucketArgs.builder().bucket(bucketName).build());
                    log.info("MinIO Bucket [{}] 创建成功", bucketName);
                } else {
                    log.info("MinIO Bucket [{}] 已存在", bucketName);
                }
            } catch (Exception e) {
                log.error("MinIO Bucket [{}] 初始化失败", bucketName, e);
                throw new RuntimeException("MinIO Bucket 初始化失败: " + bucketName, e);
            }
        });
    }
}
