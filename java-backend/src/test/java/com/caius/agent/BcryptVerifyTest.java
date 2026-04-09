package com.caius.agent;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class BcryptVerifyTest {
    @Test
    void verifyBcrypt() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        
        // 测试你数据库中的哈希
        String hash1 = "$2a$10$71/8oqvTE8Ovqk5itvOdZO.isOss/nk5RZPRnsEaICGiH7swSfQbWl55K";
        String hash2 = "$2a$10$71/8oqvTE8Ovqk5itvOdZO.isOss/nk5RZPRnsEaICGiH7swSfQbWl55K";
        
        System.out.println("==================");
        System.out.println("Testing hash: " + hash1);
        System.out.println("Matches 'admin123': " + encoder.matches("admin123", hash1));
        System.out.println("==================");
    }
}
