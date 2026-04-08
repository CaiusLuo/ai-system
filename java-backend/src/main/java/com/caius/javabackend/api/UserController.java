package com.caius.javabackend.api;

import com.caius.javabackend.module.entity.UserEntity;
import com.caius.javabackend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * @author Caius
 * @description 用户接口
 * @since Created in 2026-04-07
 */
@RestController
@RequestMapping("/users")
public class UserController {
    @Autowired
    private UserService userService;

    /**
     * 创建用户
     * @param user
     * @return
     */
    @PostMapping
    public Long create(@RequestBody UserEntity user) {
        userService.save(user);
        return user.getId();
    }

    /**
     * 通过 id 获取用户
     * @param id
     * @return
     */
    @GetMapping("/{id}")
    public UserEntity getById(@PathVariable Long id){
        return userService.getById(id);
    }

    /**
     * 获取用户列表
     * @return
     */
    @GetMapping
    public List<UserEntity> list(){
        return userService.list();
    }

    /**
     * 更新用户
     * @return
     */
    @PutMapping("/{id}")
    public Boolean update(@PathVariable Long id, @RequestBody UserEntity user){
        user.setId(id);
        return userService.updateById(user);
    }

    @DeleteMapping("/{id}")
    public Boolean deleteById(@PathVariable Long id) {
        return userService.removeById(id);
    }
}
