package com.caius.agent;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class BcryptGenCorrectTest {
    @Test
    void generateCorrect() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String raw = "admin123";
        String encoded = encoder.encode(raw);
        
        System.out.println("BEGIN_HASH");
        System.out.println(encoded);
        System.out.println("END_HASH");
        System.out.println("Length: " + encoded.length());
        System.out.println("Verify: " + encoder.matches(raw, encoded));
    }
}
