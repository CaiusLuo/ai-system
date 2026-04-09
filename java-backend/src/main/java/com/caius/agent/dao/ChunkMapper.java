package com.caius.agent.dao;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.caius.agent.module.conversation.entity.Chunk;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * Chunk Mapper
 */
@Mapper
public interface ChunkMapper extends BaseMapper<Chunk> {

    /**
     * 根据 messageId 查询所有 chunk，按 chunkIndex 排序
     */
    default List<Chunk> selectByMessageId(@Param("messageId") Long messageId) {
        return selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Chunk>()
                        .eq(Chunk::getMessageId, messageId)
                        .orderByAsc(Chunk::getChunkIndex)
        );
    }

    /**
     * 根据 conversationId 查询所有 chunk
     */
    default List<Chunk> selectByConversationId(@Param("conversationId") Long conversationId) {
        return selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Chunk>()
                        .eq(Chunk::getConversationId, conversationId)
                        .orderByAsc(Chunk::getMessageId)
                        .orderByAsc(Chunk::getChunkIndex)
        );
    }
}
