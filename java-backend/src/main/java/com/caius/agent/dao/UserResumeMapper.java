package com.caius.agent.dao;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.caius.agent.module.user.entity.UserResume;
import org.apache.ibatis.annotations.Mapper;

/**
 * 用户简历 Mapper
 */
@Mapper
public interface UserResumeMapper extends BaseMapper<UserResume> {
}
