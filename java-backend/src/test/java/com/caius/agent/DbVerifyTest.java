package com.caius.agent;

import com.caius.agent.dao.MessageMapper;
import com.caius.agent.module.conversation.entity.Message;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

@SpringBootTest
public class DbVerifyTest {

    @Autowired
    private MessageMapper messageMapper;

    @Test
    void verifyMessage() {
        System.out.println("\n=== 最新的 Message 记录 ===");
        List<Message> messages = messageMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Message>()
                        .orderByDesc(Message::getId)
                        .last("LIMIT 3")
        );
        for (Message msg : messages) {
            String preview = msg.getContent() != null && msg.getContent().length() > 40
                    ? msg.getContent().substring(0, 40) + "..."
                    : msg.getContent();
            System.out.println("ID: " + msg.getId() + ", ConvID: " + msg.getConversationId() +
                    ", Role: " + msg.getRole() + ", Title: " + msg.getTitle() +
                    ", Content: " + preview);
        }
    }
}
