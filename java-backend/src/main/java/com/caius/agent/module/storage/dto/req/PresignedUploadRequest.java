package com.caius.agent.module.storage.dto.req;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 预签名 URL 上传请求参数
 */
@Data
public class PresignedUploadRequest {

    /**
     * Bucket 类型（avatar、document）
     */
    @NotBlank(message = "bucketType 不能为空")
    private String bucketType;

    /**
     * 业务类型
     */
    private String bizType;

    /**
     * 原始文件名
     */
    @NotBlank(message = "fileName 不能为空")
    private String fileName;

    /**
     * 文件内容类型（MIME type）
     */
    @NotBlank(message = "contentType 不能为空")
    private String contentType;
}
