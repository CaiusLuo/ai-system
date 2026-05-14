package com.caius.agent.module.storage.dto.resp;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 文件上传响应对象
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UploadResponse {

    /**
     * Bucket 名称
     */
    private String bucket;

    /**
     * 对象 Key（存储路径）
     */
    private String objectKey;

    /**
     * 文件访问 URL
     */
    private String url;

    /**
     * ETag（文件唯一标识）
     */
    private String etag;

    /**
     * 文件大小（字节）
     */
    private long size;

    /**
     * 内容类型（MIME type）
     */
    private String contentType;

    /**
     * 原始文件名
     */
    private String originalFileName;
}
