package com.caius.agent.module.admin.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 更新用户请求
 */
@Data
public class UserUpdateRequest {

    @Size(min = 3, max = 50, message = "用户名长度必须在3-50之间")
    private String username;

    @Email(message = "邮箱格式不正确")
    private String email;

    @Size(min = 6, max = 50, message = "密码长度至少6位")
    private String password;

    private String role;

    private String status;
}
