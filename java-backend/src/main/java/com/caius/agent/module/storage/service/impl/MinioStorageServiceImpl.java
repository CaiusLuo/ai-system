package com.caius.agent.module.storage.service.impl;

import com.caius.agent.module.storage.config.MinioProperties;
import com.caius.agent.module.storage.dto.resp.FileInfoResponse;
import com.caius.agent.module.storage.dto.resp.PresignedUrlResponse;
import com.caius.agent.module.storage.enums.BucketType;
import com.caius.agent.module.storage.exception.StorageException;
import com.caius.agent.module.storage.service.StorageService;
import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.ZonedDateTime;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * MinIO 对象存储服务实现
 * 实现 StorageService 接口，提供 MinIO 底层操作
 * 后续切换 COS/OSS/S3 时只需提供新的实现类
 */
@Slf4j
@Service
@Lazy
@RequiredArgsConstructor
public class MinioStorageServiceImpl implements StorageService {

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    @Override
    public FileInfoResponse upload(BucketType bucketType, MultipartFile file, String objectKey, String contentType) {
        String bucketName = getBucketName(bucketType);
        try (InputStream inputStream = file.getInputStream()) {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectKey)
                            .stream(inputStream, file.getSize(), -1)
                            .contentType(contentType)
                            .build());

            log.info("文件上传成功: bucket={}, key={}, size={}", bucketName, objectKey, file.getSize());

            return buildFileInfo(bucketName, objectKey, file.getSize(), contentType, null);
        } catch (Exception e) {
            log.error("文件上传失败: bucket={}, key={}", bucketName, objectKey, e);
            throw new StorageException("文件上传失败: " + e.getMessage(), e);
        }
    }

    @Override
    public FileInfoResponse uploadStream(BucketType bucketType, InputStream inputStream, String objectKey,
                                         long size, String contentType) {
        String bucketName = getBucketName(bucketType);
        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectKey)
                            .stream(inputStream, size, -1)
                            .contentType(contentType)
                            .build());

            log.info("文件流上传成功: bucket={}, key={}, size={}", bucketName, objectKey, size);

            return buildFileInfo(bucketName, objectKey, size, contentType, null);
        } catch (Exception e) {
            log.error("文件流上传失败: bucket={}, key={}", bucketName, objectKey, e);
            throw new StorageException("文件流上传失败: " + e.getMessage(), e);
        }
    }

    @Override
    public PresignedUrlResponse getPresignedUploadUrl(BucketType bucketType, String objectKey,
                                                      String contentType, int expireMinutes) {
        String bucketName = getBucketName(bucketType);
        try {
            String url = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .bucket(bucketName)
                            .object(objectKey)
                            .method(Method.PUT)
                            .expiry(expireMinutes, TimeUnit.MINUTES)
                            .extraHeaders(Map.of("Content-Type", contentType))
                            .build());

            return PresignedUrlResponse.builder()
                    .presignedUrl(url)
                    .objectKey(objectKey)
                    .bucket(bucketName)
                    .expireMinutes(expireMinutes)
                    .method("PUT")
                    .build();
        } catch (Exception e) {
            log.error("获取预签名上传 URL 失败: bucket={}, key={}", bucketName, objectKey, e);
            throw new StorageException("获取预签名上传 URL 失败: " + e.getMessage(), e);
        }
    }

    @Override
    public PresignedUrlResponse getPresignedDownloadUrl(String bucket, String objectKey, int expireMinutes) {
        try {
            String url = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .method(Method.GET)
                            .expiry(expireMinutes, TimeUnit.MINUTES)
                            .build());

            return PresignedUrlResponse.builder()
                    .presignedUrl(url)
                    .objectKey(objectKey)
                    .bucket(bucket)
                    .expireMinutes(expireMinutes)
                    .method("GET")
                    .build();
        } catch (Exception e) {
            log.error("获取预签名下载 URL 失败: bucket={}, key={}", bucket, objectKey, e);
            throw new StorageException("获取预签名下载 URL 失败: " + e.getMessage(), e);
        }
    }

    @Override
    public void remove(String bucket, String objectKey) {
        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .build());

            log.info("文件删除成功: bucket={}, key={}", bucket, objectKey);
        } catch (Exception e) {
            log.error("文件删除失败: bucket={}, key={}", bucket, objectKey, e);
            throw new StorageException("文件删除失败: " + e.getMessage(), e);
        }
    }

    @Override
    public FileInfoResponse stat(String bucket, String objectKey) {
        try {
            StatObjectResponse stat = minioClient.statObject(
                    StatObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .build());

            return buildFileInfo(bucket, objectKey, stat.size(), stat.contentType(), stat.etag());
        } catch (Exception e) {
            log.error("获取文件信息失败: bucket={}, key={}", bucket, objectKey, e);
            throw new StorageException("获取文件信息失败: " + e.getMessage(), e);
        }
    }

    @Override
    public boolean exists(String bucket, String objectKey) {
        try {
            minioClient.statObject(
                    StatObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .build());
            return true;
        } catch (io.minio.errors.ErrorResponseException e) {
            // 404 表示对象不存在
            if (e.errorResponse() != null && "NoSuchKey".equals(e.errorResponse().code())) {
                return false;
            }
            throw new StorageException("检查文件存在失败: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("检查文件存在失败: bucket={}, key={}", bucket, objectKey, e);
            throw new StorageException("检查文件存在失败: " + e.getMessage(), e);
        }
    }

    @Override
    public String getFileUrl(String bucket, String objectKey, int expireMinutes) {
        if (StringUtils.hasText(minioProperties.getPublicBaseUrl())) {
            String normalizedBaseUrl = minioProperties.getPublicBaseUrl().replaceAll("/+$", "");
            String normalizedKey = objectKey.startsWith("/") ? objectKey.substring(1) : objectKey;
            return normalizedBaseUrl + "/" + bucket + "/" + normalizedKey;
        }

        PresignedUrlResponse response = getPresignedDownloadUrl(bucket, objectKey, expireMinutes);
        return response.getPresignedUrl();
    }

    @Override
    public String getBucketName(BucketType bucketType) {
        String name = minioProperties.getBuckets().get(bucketType.getConfigKey());
        if (name == null || name.isBlank()) {
            throw new StorageException("未配置 Bucket 名称: " + bucketType.getConfigKey());
        }
        return name;
    }

    /**
     * 构建文件信息响应对象
     */
    private FileInfoResponse buildFileInfo(String bucket, String objectKey, long size,
                                           String contentType, String etag) {
        try {
            StatObjectResponse stat = minioClient.statObject(
                    StatObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectKey)
                            .build());
            ZonedDateTime lastModified = stat.lastModified();
            return FileInfoResponse.builder()
                    .bucket(bucket)
                    .objectKey(objectKey)
                    .size(size)
                    .contentType(contentType)
                    .etag(etag != null ? etag : stat.etag())
                    .lastModified(lastModified != null ? lastModified.toString() : null)
                    .build();
        } catch (Exception e) {
            // 如果获取 lastModified 失败，返回基本信息
            return FileInfoResponse.builder()
                    .bucket(bucket)
                    .objectKey(objectKey)
                    .size(size)
                    .contentType(contentType)
                    .etag(etag)
                    .lastModified(null)
                    .build();
        }
    }
}
