package com.caius.javabackend.dao.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.caius.javabackend.module.entity.UserEntity;
import org.apache.ibatis.annotations.Mapper;

/**
 * @author Caius
 * @description 用户 mapper
 * @since Created in 2026-04-07
 */
@Mapper
public interface UserMapper extends BaseMapper<UserEntity> {

}
