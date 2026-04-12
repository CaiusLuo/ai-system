package com.caius.agent;

import com.caius.agent.dao.MessageMapper;
import com.caius.agent.module.conversation.entity.Message;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Disabled;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

/**
 * 数据库集成验证测试
 *
 * ⚠️ 注意：此测试依赖真实数据库和 migration 执行。
 * 在运行此测试前，请先执行: sql/migration_add_streaming_status.sql
 */
@SpringBootTest
public class DbVerifyTest {

    @Autowired
    private MessageMapper messageMapper;

    @Test
    @Disabled("需要先执行 sql/migration_add_streaming_status.sql 添加 streaming_status 列")
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
                    ", StreamingStatus: " + msg.getStreamingStatus() +
                    ", Content: " + preview);
        }
    }
}
