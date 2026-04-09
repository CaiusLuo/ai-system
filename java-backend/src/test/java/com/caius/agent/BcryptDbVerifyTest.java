package com.caius.agent;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class BcryptDbVerifyTest {
    @Test
    void verifyDbPassword() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String dbHash = "$2a$10$pxsRwQpjmj9xTd/so6AaFuesa6j7vkJPV82JnyHnMiqpJm1ZXHx/";
        String raw = "admin123";
        
        System.out.println("=== 验证数据库密码 ===");
        System.out.println("DB Hash: " + dbHash);
        System.out.println("Raw: " + raw);
        System.out.println("Matches: " + encoder.matches(raw, dbHash));
        System.out.println("Hash length: " + dbHash.length());
        System.out.println("====================");
    }
}
