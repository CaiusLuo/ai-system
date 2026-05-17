package com.caius.agent.module.user.service;

import com.caius.agent.module.storage.config.MinioProperties;
import com.caius.agent.module.storage.enums.BucketType;
import com.caius.agent.module.storage.service.StorageService;
import com.caius.agent.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 统一解析用户头像访问地址。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AvatarUrlResolver {

    private final ObjectProvider<StorageService> storageServiceProvider;
    private final MinioProperties minioProperties;

    private static final String DEFAULT_AVATAR_KEY = "avatar/IMG_0317.jpeg";

    public String resolve(User user) {
        StorageService storageService = storageServiceProvider.getIfAvailable();
        if (storageService == null) {
            return null;
        }

        // 如果用户有自定义头像，则解析自定义头像
        if (user != null && StringUtils.hasText(user.getAvatarBucket()) && StringUtils.hasText(user.getAvatarObjectKey())) {
            try {
                return storageService.getFileUrl(
                        user.getAvatarBucket(),
                        user.getAvatarObjectKey(),
                        minioProperties.getUrlExpireMinutes()
                );
            } catch (Exception ex) {
                log.warn("解析自定义头像 URL 失败，将回退到默认头像: userId={}, bucket={}, key={}",
                        user.getId(), user.getAvatarBucket(), user.getAvatarObjectKey(), ex);
            }
        }

        // 返回默认头像 URL
        try {
            String avatarBucket = storageService.getBucketName(BucketType.AVATAR);
            return storageService.getFileUrl(
                    avatarBucket,
                    DEFAULT_AVATAR_KEY,
                    minioProperties.getUrlExpireMinutes()
            );
        } catch (Exception ex) {
            log.warn("解析默认头像 URL 失败: {}", ex.getMessage());
            return null;
        }
    }
}
