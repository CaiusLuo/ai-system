package com.caius.agent.module.storage.util;

import com.caius.agent.module.storage.config.MinioProperties;
import com.caius.agent.module.storage.enums.BucketType;
import com.caius.agent.module.storage.exception.StorageException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.util.Set;

/**
 * 文件校验工具类
 * 负责文件类型、大小等基础校验
 */
@Component
@RequiredArgsConstructor
public class FileValidator {

    private final MinioProperties minioProperties;

    /**
     * 头像允许的扩展名
     */
    private static final Set<String> AVATAR_ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");

    /**
     * 头像允许的内容类型
     */
    private static final Set<String> AVATAR_ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp");

    /**
     * 文档允许的扩展名
     */
    private static final Set<String> DOCUMENT_ALLOWED_EXTENSIONS = Set.of("pdf");

    /**
     * 文档允许的内容类型
     */
    private static final Set<String> DOCUMENT_ALLOWED_CONTENT_TYPES = Set.of("application/pdf");

    /**
     * 校验头像文件
     */
    public void validateAvatarFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new StorageException(400, "上传文件不能为空");
        }

        // 文件大小校验
        long maxAvatarSize = minioProperties.getMaxAvatarSizeBytes();
        if (file.getSize() > maxAvatarSize) {
            throw new StorageException(400, "头像文件大小超过限制（最大 " + formatSize(maxAvatarSize) + "）");
        }

        // 文件扩展名校验
        String originalFilename = file.getOriginalFilename();
        String extension = getFileExtension(originalFilename);
        if (!AVATAR_ALLOWED_EXTENSIONS.contains(extension.toLowerCase())) {
            throw new StorageException(400, "头像文件仅支持以下格式: " + AVATAR_ALLOWED_EXTENSIONS);
        }

        // 内容类型校验
        String contentType = file.getContentType();
        if (contentType == null || !AVATAR_ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new StorageException(400, "头像文件内容类型不合法");
        }
    }

    /**
     * 校验头像文件元数据（预签名上传场景）
     */
    public void validateAvatarMetadata(String originalFilename, String contentType) {
        String extension = getFileExtension(originalFilename);
        if (!AVATAR_ALLOWED_EXTENSIONS.contains(extension.toLowerCase())) {
            throw new StorageException(400, "头像文件仅支持以下格式: " + AVATAR_ALLOWED_EXTENSIONS);
        }
        if (contentType == null || !AVATAR_ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new StorageException(400, "头像文件内容类型不合法");
        }
    }

    /**
     * 校验文档文件
     */
    public void validateDocumentFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new StorageException(400, "上传文件不能为空");
        }

        // 文件大小校验
        long maxDocumentSize = minioProperties.getMaxDocumentSizeBytes();
        if (file.getSize() > maxDocumentSize) {
            throw new StorageException(400, "文档文件大小超过限制（最大 " + formatSize(maxDocumentSize) + "）");
        }

        // 文件扩展名校验
        String originalFilename = file.getOriginalFilename();
        String extension = getFileExtension(originalFilename);
        if (!DOCUMENT_ALLOWED_EXTENSIONS.contains(extension.toLowerCase())) {
            throw new StorageException(400, "文档文件仅支持 PDF 格式");
        }

        // 内容类型校验
        String contentType = file.getContentType();
        if (contentType == null || !DOCUMENT_ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new StorageException(400, "文档文件内容类型不合法，仅支持 application/pdf");
        }
    }

    /**
     * 校验文档文件元数据（预签名上传场景）
     */
    public void validateDocumentMetadata(String originalFilename, String contentType) {
        String extension = getFileExtension(originalFilename);
        if (!DOCUMENT_ALLOWED_EXTENSIONS.contains(extension.toLowerCase())) {
            throw new StorageException(400, "文档文件仅支持 PDF 格式");
        }
        if (contentType == null || !DOCUMENT_ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new StorageException(400, "文档文件内容类型不合法，仅支持 application/pdf");
        }
    }

    /**
     * 校验通用文件内容类型
     */
    public void validateContentType(String contentType, Set<String> allowedTypes) {
        if (contentType == null || !allowedTypes.contains(contentType.toLowerCase())) {
            throw new StorageException(400, "文件内容类型不合法");
        }
    }

    /**
     * 获取文件扩展名
     */
    private String getFileExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf(".") + 1);
    }

    /**
     * 格式化文件大小显示
     */
    private String formatSize(long bytes) {
        if (bytes >= 1024 * 1024 * 1024) {
            return (bytes / (1024 * 1024 * 1024)) + "GB";
        } else if (bytes >= 1024 * 1024) {
            return (bytes / (1024 * 1024)) + "MB";
        } else if (bytes >= 1024) {
            return (bytes / 1024) + "KB";
        }
        return bytes + "B";
    }
}
