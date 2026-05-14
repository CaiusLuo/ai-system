package com.caius.agent.module.storage.dto.req;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 文件信息查询请求参数
 */
@Data
public class FileInfoRequest {

    /**
     * Bucket 名称
     */
    @NotBlank(message = "bucket 不能为空")
    private String bucket;

    /**
     * 对象 Key
     */
    @NotBlank(message = "objectKey 不能为空")
    private String objectKey;
}
