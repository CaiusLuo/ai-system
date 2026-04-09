package com.caius.agent.module.admin.dto;

import lombok.Data;

/**
 * 用户列表查询请求
 */
@Data
public class UserListRequest {

    /**
     * 页码（从 1 开始）
     */
    private Integer page = 1;

    /**
     * 每页数量
     */
    private Integer pageSize = 10;

    /**
     * 搜索关键词（匹配用户名或邮箱）
     */
    private String keyword;

    /**
     * 角色筛选：ADMIN 或 USER
     */
    private String role;

    /**
     * 状态筛选：ACTIVE 或 DISABLED
     */
    private String status;
}
