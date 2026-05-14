package com.caius.agent.module.storage.service;

import com.caius.agent.module.storage.dto.resp.FileInfoResponse;
import com.caius.agent.module.storage.dto.resp.PresignedUrlResponse;
import com.caius.agent.module.storage.enums.BucketType;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;

/**
 * 对象存储服务接口
 * 业务层应依赖此接口而非具体实现，便于后续切换 COS/OSS/S3
 */
public interface StorageService {

    /**
     * 上传文件（通过 MultipartFile）
     *
     * @param bucketType Bucket 类型
     * @param file       上传的文件
     * @param objectKey  对象 Key（存储路径）
     * @param contentType 内容类型
     * @return 上传结果信息
     */
    FileInfoResponse upload(BucketType bucketType, MultipartFile file, String objectKey, String contentType);

    /**
     * 上传文件（通过 InputStream）
     *
     * @param bucketType  Bucket 类型
     * @param inputStream 文件输入流
     * @param objectKey   对象 Key
     * @param size        文件大小
     * @param contentType 内容类型
     * @return 上传结果信息
     */
    FileInfoResponse uploadStream(BucketType bucketType, InputStream inputStream, String objectKey,
                                  long size, String contentType);

    /**
     * 获取预签名上传 URL
     *
     * @param bucketType  Bucket 类型
     * @param objectKey   对象 Key
     * @param contentType 内容类型
     * @param expireMinutes 过期时间（分钟）
     * @return 预签名 URL 信息
     */
    PresignedUrlResponse getPresignedUploadUrl(BucketType bucketType, String objectKey,
                                               String contentType, int expireMinutes);

    /**
     * 获取预签名下载 URL
     *
     * @param bucket  Bucket 名称
     * @param objectKey 对象 Key
     * @param expireMinutes 过期时间（分钟）
     * @return 预签名 URL 信息
     */
    PresignedUrlResponse getPresignedDownloadUrl(String bucket, String objectKey, int expireMinutes);

    /**
     * 删除对象
     *
     * @param bucket    Bucket 名称
     * @param objectKey 对象 Key
     */
    void remove(String bucket, String objectKey);

    /**
     * 获取文件信息
     *
     * @param bucket    Bucket 名称
     * @param objectKey 对象 Key
     * @return 文件信息
     */
    FileInfoResponse stat(String bucket, String objectKey);

    /**
     * 检查对象是否存在
     *
     * @param bucket    Bucket 名称
     * @param objectKey 对象 Key
     * @return 是否存在
     */
    boolean exists(String bucket, String objectKey);

    /**
     * 获取文件访问 URL（带过期时间）
     *
     * @param bucket    Bucket 名称
     * @param objectKey 对象 Key
     * @param expireMinutes 过期时间（分钟）
     * @return 可访问的 URL
     */
    String getFileUrl(String bucket, String objectKey, int expireMinutes);

    /**
     * 获取 Bucket 名称
     *
     * @param bucketType Bucket 类型
     * @return Bucket 名称
     */
    String getBucketName(BucketType bucketType);
}
