package com.caius.agent.module.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 用户 DTO（隐藏敏感信息）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDTO {
    
    /**
     * 用户ID
     */
    private Long id;
    
    /**
     * 用户名
     */
    private String username;
    
    /**
     * 邮箱
     */
    private String email;
    
    /**
     * 角色
     */
    private String role;
    
    /**
     * 状态
     */
    private Integer status;
    
    /**
     * 状态文本
     */
    private String statusText;
}
