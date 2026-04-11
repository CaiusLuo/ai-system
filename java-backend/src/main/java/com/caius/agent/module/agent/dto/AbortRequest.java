package com.caius.agent.module.agent.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Abort 请求 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AbortRequest {

    /**
     * 消息 ID（UUID）
     */
    private String messageId;
}
