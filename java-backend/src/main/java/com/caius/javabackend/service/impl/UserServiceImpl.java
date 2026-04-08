package com.caius.javabackend.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.caius.javabackend.dao.mapper.UserMapper;
import com.caius.javabackend.module.entity.UserEntity;
import com.caius.javabackend.service.UserService;
import org.springframework.stereotype.Service;

/**
 * @author Caius
 * @description
 * @since Created in 2026/4/8
 */
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, UserEntity> implements UserService{

}
