package com.caius.agent.module.user.controller;

import com.caius.agent.common.result.Result;
import com.caius.agent.module.storage.config.MinioProperties;
import com.caius.agent.module.storage.service.StorageService;
import com.caius.agent.module.user.entity.UserResume;
import com.caius.agent.module.user.service.ResumeService;
import com.caius.agent.module.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 简历管理控制器
 */
@RestController
@RequestMapping("/api/resumes")
@RequiredArgsConstructor
public class ResumeController {

    private final ResumeService resumeService;
    private final UserService userService;
    private final StorageService storageService;
    private final MinioProperties minioProperties;

    /**
     * 获取当前用户的简历列表
     */
    @GetMapping
    public Result<List<ResumeDTO>> listResumes(@AuthenticationPrincipal Long userId) {
        List<UserResume> resumes = resumeService.listResumes(userId);
        List<ResumeDTO> dtoList = resumes.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
        return Result.success(dtoList);
    }

    /**
     * 删除简历
     */
    @DeleteMapping("/{id}")
    public Result<Void> deleteResume(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
        resumeService.deleteResume(id, userId);
        return Result.success();
    }

    /**
     * 设置活跃简历
     */
    @PostMapping("/{id}/activate")
    public Result<Void> activateResume(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
        resumeService.getById(id); // 简单校验是否存在
        userService.updateActiveResume(userId, id);
        return Result.success();
    }

    private ResumeDTO convertToDTO(UserResume resume) {
        String url = storageService.getFileUrl(resume.getBucket(), resume.getObjectKey(), 
                minioProperties.getUrlExpireMinutes());
        
        return ResumeDTO.builder()
                .id(resume.getId())
                .name(resume.getFileName())
                .url(url)
                .size(resume.getFileSize())
                .uploadedAt(resume.getCreatedAt().toString())
                .build();
    }

    @lombok.Data
    @lombok.Builder
    public static class ResumeDTO {
        private Long id;
        private String name;
        private String url;
        private Long size;
        private String uploadedAt;
    }
}
