package com.caius.agent.module.user.service;

import com.caius.agent.module.storage.config.MinioProperties;
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

    public String resolve(User user) {
        if (user == null) {
            return null;
        }
        if (!StringUtils.hasText(user.getAvatarBucket()) || !StringUtils.hasText(user.getAvatarObjectKey())) {
            return null;
        }

        try {
            StorageService storageService = storageServiceProvider.getIfAvailable();
            if (storageService == null) {
                return null;
            }
            return storageService.getFileUrl(
                    user.getAvatarBucket(),
                    user.getAvatarObjectKey(),
                    minioProperties.getUrlExpireMinutes()
            );
        } catch (Exception ex) {
            log.warn("解析头像 URL 失败: userId={}, bucket={}, key={}",
                    user.getId(), user.getAvatarBucket(), user.getAvatarObjectKey(), ex);
            return null;
        }
    }
}
