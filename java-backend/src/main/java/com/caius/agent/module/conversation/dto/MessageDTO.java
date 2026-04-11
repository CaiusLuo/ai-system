package com.caius.agent.module.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 消息 DTO，包含用户信息
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageDTO {
    
    /**
     * 消息ID
     */
    private Long id;
    
    /**
     * 会话ID
     */
    private Long conversationId;
    
    /**
     * 用户ID
     */
    private Long userId;
    
    /**
     * 用户名
     */
    private String username;
    
    /**
     * 消息角色
     */
    private String role;
    
    /**
     * 消息内容
     */
    private String content;
    
    /**
     * 消息标题
     */
    private String title;
    
    /**
     * 创建时间
     */
    private LocalDateTime createdAt;
    
    /**
     * 更新时间
     */
    private LocalDateTime updatedAt;
}
