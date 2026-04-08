package com.caius.agent.dao;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.caius.agent.module.user.entity.User;
import org.apache.ibatis.annotations.Mapper;

/**
 * 用户 Mapper
 */
@Mapper
public interface UserMapper extends BaseMapper<User> {
}
