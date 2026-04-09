package com.caius.agent.module.agent.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 流式聊天请求 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StreamChatRequest {

    @NotBlank(message = "消息不能为空")
    private String message;

    private String sessionId;

    private Long conversationId;
}
