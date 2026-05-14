package com.caius.agent.module.storage.dto.req;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 上传文件请求参数
 */
@Data
public class UploadRequest {

    /**
     * 用户 ID
     */
    @NotNull(message = "userId 不能为空")
    private Long userId;

    /**
     * 业务类型（avatar、resume、chat-file、kb-source、document）
     */
    @NotBlank(message = "bizType 不能为空")
    private String bizType;
}
