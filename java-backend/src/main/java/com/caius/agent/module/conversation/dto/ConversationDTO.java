package com.caius.agent.module.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 会话 DTO，包含最新消息预览
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationDTO {
    
    /**
     * 会话ID
     */
    private Long id;
    
    /**
     * 用户ID
     */
    private Long userId;
    
    /**
     * 会话标题
     */
    private String title;
    
    /**
     * 最新消息内容（预览）
     */
    private String lastMessageContent;
    
    /**
     * 最新消息时间
     */
    private LocalDateTime lastMessageTime;
    
    /**
     * 创建时间
     */
    private LocalDateTime createdAt;
    
    /**
     * 更新时间
     */
    private LocalDateTime updatedAt;
}
