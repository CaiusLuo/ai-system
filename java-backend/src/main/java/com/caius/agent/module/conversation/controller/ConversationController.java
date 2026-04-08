package com.caius.agent.module.conversation.controller;

import com.caius.agent.common.result.Result;
import com.caius.agent.module.conversation.entity.Conversation;
import com.caius.agent.module.conversation.entity.Message;
import com.caius.agent.module.conversation.service.ConversationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 会话控制器
 */
@RestController
@RequestMapping("/conversation")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;

    @GetMapping("/list")
    public Result<List<Conversation>> listConversations(@AuthenticationPrincipal Long userId) {
        List<Conversation> conversations = conversationService.getConversations(userId);
        return Result.success(conversations);
    }

    @GetMapping("/{id}/messages")
    public Result<List<Message>> getMessages(@AuthenticationPrincipal Long userId,
                                             @PathVariable Long id) {
        List<Message> messages = conversationService.getMessages(id, userId);
        return Result.success(messages);
    }

    @DeleteMapping("/{id}")
    public Result<String> deleteConversation(@AuthenticationPrincipal Long userId,
                                           @PathVariable Long id) {
        conversationService.deleteConversation(id, userId);
        return Result.success("删除成功", null);
    }
}
