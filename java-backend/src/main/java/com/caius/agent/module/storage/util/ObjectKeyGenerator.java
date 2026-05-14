package com.caius.agent.module.storage.util;

import com.caius.agent.module.storage.enums.BizType;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * 对象 Key 生成器
 * 生成具有层级结构的对象路径，便于运维排查
 *
 * 命名规则：
 * - 用户头像：avatar/{userId}/{yyyy}/{MM}/{uuid}.jpg
 * - PDF 文档：document/{bizType}/{userId}/{yyyy}/{MM}/{uuid}-{safeFileName}.pdf
 */
public class ObjectKeyGenerator {

    private static final DateTimeFormatter YEAR_MONTH_FORMATTER = DateTimeFormatter.ofPattern("yyyy/MM");

    private ObjectKeyGenerator() {
    }

    /**
     * 生成头像对象 Key
     *
     * @param userId 用户 ID
     * @param extension 文件扩展名（如 jpg、png）
     * @return 对象 Key
     */
    public static String generateAvatarKey(Long userId, String extension) {
        String datePath = LocalDate.now().format(YEAR_MONTH_FORMATTER);
        String uuid = UUID.randomUUID().toString().replace("-", "");
        String safeExt = sanitizeExtension(extension);
        return "avatar/%s/%s/%s.%s".formatted(userId, datePath, uuid, safeExt);
    }

    /**
     * 生成文档对象 Key
     *
     * @param bizType 业务类型
     * @param userId 用户 ID
     * @param originalFileName 原始文件名
     * @param extension 文件扩展名
     * @return 对象 Key
     */
    public static String generateDocumentKey(String bizType, Long userId,
                                             String originalFileName, String extension) {
        String datePath = LocalDate.now().format(YEAR_MONTH_FORMATTER);
        String uuid = UUID.randomUUID().toString().replace("-", "");
        String safeName = sanitizeFileName(originalFileName);
        String safeExt = sanitizeExtension(extension);
        return "document/%s/%s/%s/%s-%s.%s".formatted(
                bizType, userId, datePath, uuid, safeName, safeExt);
    }

    /**
     * 通用对象 Key 生成
     *
     * @param bizType 业务类型
     * @param userId 用户 ID
     * @param originalFileName 原始文件名
     * @param extension 文件扩展名
     * @return 对象 Key
     */
    public static String generateKey(BizType bizType, Long userId,
                                     String originalFileName, String extension) {
        String datePath = LocalDate.now().format(YEAR_MONTH_FORMATTER);
        String uuid = UUID.randomUUID().toString().replace("-", "");
        String safeName = sanitizeFileName(originalFileName);
        String safeExt = sanitizeExtension(extension);
        return "%s/%s/%s/%s/%s-%s.%s".formatted(
                bizType.getCode(), bizType.name().toLowerCase(), userId, datePath, uuid, safeName, safeExt);
    }

    /**
     * 安全化处理文件名
     * 移除特殊字符，仅保留字母、数字、下划线、中文字符
     */
    public static String sanitizeFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "unnamed";
        }
        // 移除路径分隔符和特殊字符
        String name = fileName.replaceAll("[/\\\\:*?\"<>|]", "");
        // 截取前 50 个字符避免过长
        if (name.length() > 50) {
            name = name.substring(0, 50);
        }
        return name.isBlank() ? "unnamed" : name;
    }

    /**
     * 安全化处理扩展名
     */
    public static String sanitizeExtension(String extension) {
        if (extension == null || extension.isBlank()) {
            return "bin";
        }
        // 移除点号（如果有）
        String ext = extension.startsWith(".") ? extension.substring(1) : extension;
        // 仅保留字母数字
        ext = ext.replaceAll("[^a-zA-Z0-9]", "");
        return ext.isBlank() ? "bin" : ext.toLowerCase();
    }

    /**
     * 从文件名获取扩展名
     */
    public static String getExtension(String fileName) {
        if (fileName == null || !fileName.contains(".")) {
            return "";
        }
        return fileName.substring(fileName.lastIndexOf(".") + 1);
    }

    /**
     * 判断对象 Key 是否属于指定用户。
     */
    public static boolean belongsToUser(String objectKey, Long userId) {
        if (objectKey == null || objectKey.isBlank() || userId == null) {
            return false;
        }

        String[] segments = objectKey.split("/");
        if (segments.length < 2) {
            return false;
        }

        if ("avatar".equals(segments[0])) {
            return segments.length >= 2 && String.valueOf(userId).equals(segments[1]);
        }

        if ("document".equals(segments[0])) {
            return segments.length >= 3 && String.valueOf(userId).equals(segments[2]);
        }

        return false;
    }
}
