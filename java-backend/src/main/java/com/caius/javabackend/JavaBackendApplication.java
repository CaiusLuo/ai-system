package com.caius.javabackend;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.caius.javabackend.dao.mapper")
public class JavaBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(JavaBackendApplication.class, args);
    }

}
