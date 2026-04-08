package com.caius.agent.module.agent.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 聊天请求 DTO
 */
@Data
public class ChatRequest {

    @NotBlank(message = "消息内容不能为空")
    private String message;

    private Long conversationId;
}
