package com.caius.agent.module.user.service;

import com.caius.agent.module.user.entity.UserResume;
import java.util.List;

/**
 * 简历服务接口
 */
public interface ResumeService {

    /**
     * 保存简历记录
     */
    UserResume saveResume(Long userId, String fileName, String bucket, String objectKey, Long fileSize);

    /**
     * 获取用户简历列表
     */
    List<UserResume> listResumes(Long userId);

    /**
     * 获取单个简历详情
     */
    UserResume getById(Long id);

    /**
     * 删除简历
     */
    void deleteResume(Long id, Long userId);
}
