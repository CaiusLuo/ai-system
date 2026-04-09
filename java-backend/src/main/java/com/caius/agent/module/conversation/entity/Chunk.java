package com.caius.agent.module.conversation.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Chunk 实体 - 流式消息片段
 * 与 Conversation 是 n-1 关系，多个 chunk 组成一个 message
 */
@Data
@TableName("chunk")
public class Chunk {

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 所属会话 ID
     */
    private Long conversationId;

    /**
     * 所属消息 ID（组装后的 message）
     */
    private Long messageId;

    /**
     * 用户 ID
     */
    private Long userId;

    /**
     * 角色：user / assistant / system
     */
    private String role;

    /**
     * chunk 内容片段
     */
    private String content;

    /**
     * chunk 序号，用于排序拼接
     */
    private Integer chunkIndex;

    /**
     * 是否为最后一个 chunk
     */
    private Boolean isLast;

    /**
     * Agent 总结信息（仅在最后一个 chunk 中存储）
     */
    private String title;

    /**
     * 逻辑删除：0-未删除，1-已删除
     */
    @TableLogic
    private Integer deleted;

    /**
     * 创建时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
