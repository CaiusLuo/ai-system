package com.caius.agent.module.agent.controller;

import com.caius.agent.common.result.Result;
import com.caius.agent.module.agent.dto.ChatRequest;
import com.caius.agent.module.agent.dto.ChatResponse;
import com.caius.agent.module.agent.service.AgentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Agent 控制器
 */
@RestController
@RequestMapping("/agent")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;

    @PostMapping("/chat")
    public Result<ChatResponse> chat(@AuthenticationPrincipal Long userId,
                                     @Valid @RequestBody ChatRequest request) {
        ChatResponse response = agentService.chat(userId, request);
        return Result.success(response);
    }
}
