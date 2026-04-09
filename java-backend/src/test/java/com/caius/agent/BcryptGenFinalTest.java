package com.caius.agent;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class BcryptGenFinalTest {
    @Test
    void generateCorrectBcrypt() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String raw = "admin123";
        String encoded = encoder.encode(raw);
        
        System.out.println("=== 正确的 BCrypt 哈希 ===");
        System.out.println(encoded);
        System.out.println("验证: " + encoder.matches(raw, encoded));
        System.out.println("========================");
    }
}
