package com.caius.agent.module.user.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.dao.UserResumeMapper;
import com.caius.agent.module.user.entity.UserResume;
import com.caius.agent.module.user.service.ResumeService;
import com.caius.agent.module.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 简历服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeServiceImpl implements ResumeService {

    private final UserResumeMapper resumeMapper;
    private final UserService userService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserResume saveResume(Long userId, String fileName, String bucket, String objectKey, Long fileSize) {
        UserResume resume = new UserResume();
        resume.setUserId(userId);
        resume.setFileName(fileName);
        resume.setBucket(bucket);
        resume.setObjectKey(objectKey);
        resume.setFileSize(fileSize);

        resumeMapper.insert(resume);
        
        // 上传第一个简历时，默认设为活跃简历
        userService.updateActiveResume(userId, resume.getId());
        
        log.info("用户简历保存成功: userId={}, resumeId={}, fileName={}", userId, resume.getId(), fileName);
        return resume;
    }

    @Override
    public List<UserResume> listResumes(Long userId) {
        LambdaQueryWrapper<UserResume> query = new LambdaQueryWrapper<>();
        query.eq(UserResume::getUserId, userId)
             .orderByDesc(UserResume::getCreatedAt);
        return resumeMapper.selectList(query);
    }

    @Override
    public UserResume getById(Long id) {
        return resumeMapper.selectById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteResume(Long id, Long userId) {
        UserResume resume = resumeMapper.selectById(id);
        if (resume == null || !resume.getUserId().equals(userId)) {
            throw new BusinessException("简历不存在或无权操作");
        }
        
        resumeMapper.deleteById(id);
        log.info("用户简历删除成功: userId={}, resumeId={}", userId, id);
    }
}
