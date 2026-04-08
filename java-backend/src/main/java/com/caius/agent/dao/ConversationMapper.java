package com.caius.agent.dao;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.caius.agent.module.conversation.entity.Conversation;
import org.apache.ibatis.annotations.Mapper;

/**
 * 会话 Mapper
 */
@Mapper
public interface ConversationMapper extends BaseMapper<Conversation> {
}
