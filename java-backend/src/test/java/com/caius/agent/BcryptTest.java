package com.caius.agent;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class BcryptTest {
    @Test
    void generateBcrypt() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String raw = "admin123";
        String encoded = encoder.encode(raw);
        System.out.println("==================");
        System.out.println("Raw password: " + raw);
        System.out.println("BCrypt hash: " + encoded);
        System.out.println("Verify: " + encoder.matches(raw, encoded));
        System.out.println("==================");
    }
}
