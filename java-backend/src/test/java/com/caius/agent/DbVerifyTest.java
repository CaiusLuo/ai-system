package com.caius.agent;

import com.caius.agent.dao.ChunkMapper;
import com.caius.agent.dao.MessageMapper;
import com.caius.agent.module.conversation.entity.Chunk;
import com.caius.agent.module.conversation.entity.Message;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.stream.Collectors;

@SpringBootTest
public class DbVerifyTest {

    @Autowired
    private MessageMapper messageMapper;

    @Autowired
    private ChunkMapper chunkMapper;

    @Test
    void verifyChunkAndMessage() {
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

        System.out.println("\n=== 最新 Message 对应的 Chunk ===");
        if (!messages.isEmpty()) {
            Long latestMsgId = messages.get(0).getId();
            List<Chunk> chunks = chunkMapper.selectByMessageId(latestMsgId);
            System.out.println("Message ID " + latestMsgId + " 的 Chunk 数量: " + chunks.size());
            
            if (!chunks.isEmpty()) {
                String fullContent = chunks.stream()
                        .sorted((a, b) -> a.getChunkIndex() - b.getChunkIndex())
                        .map(Chunk::getContent)
                        .collect(Collectors.joining());
                String preview = fullContent.length() > 100 ? fullContent.substring(0, 100) + "..." : fullContent;
                System.out.println("聚合内容: " + preview);
            }
        }
    }
}
