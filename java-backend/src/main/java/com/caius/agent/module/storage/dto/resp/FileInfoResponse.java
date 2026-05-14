package com.caius.agent.module.storage.dto.resp;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 文件信息响应对象
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileInfoResponse {

    /**
     * Bucket 名称
     */
    private String bucket;

    /**
     * 对象 Key
     */
    private String objectKey;

    /**
     * 文件大小（字节）
     */
    private long size;

    /**
     * 内容类型
     */
    private String contentType;

    /**
     * ETag
     */
    private String etag;

    /**
     * 最后修改时间
     */
    private String lastModified;
}
