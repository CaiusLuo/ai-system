package com.caius.agent.dao;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.caius.agent.module.conversation.entity.Message;
import org.apache.ibatis.annotations.Mapper;

/**
 * 消息 Mapper
 */
@Mapper
public interface MessageMapper extends BaseMapper<Message> {
}
