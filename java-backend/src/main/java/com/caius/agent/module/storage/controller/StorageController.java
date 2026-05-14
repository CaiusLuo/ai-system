package com.caius.agent.module.storage.controller;

import com.caius.agent.common.result.Result;
import com.caius.agent.common.exception.BusinessException;
import com.caius.agent.module.storage.config.MinioProperties;
import com.caius.agent.module.storage.dto.req.FileInfoRequest;
import com.caius.agent.module.storage.dto.req.PresignedDownloadRequest;
import com.caius.agent.module.storage.dto.req.PresignedUploadRequest;
import com.caius.agent.module.storage.dto.resp.FileInfoResponse;
import com.caius.agent.module.storage.dto.resp.PresignedUrlResponse;
import com.caius.agent.module.storage.dto.resp.UploadResponse;
import com.caius.agent.module.storage.enums.BizType;
import com.caius.agent.module.storage.enums.BucketType;
import com.caius.agent.module.storage.service.StorageService;
import com.caius.agent.module.storage.util.FileValidator;
import com.caius.agent.module.storage.util.ObjectKeyGenerator;
import com.caius.agent.module.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.StringUtils;

/**
 * 对象存储 REST API
 * 提供头像上传、文档上传、预签名 URL、文件删除、文件信息查询等接口
 */
@Slf4j
@RestController
@RequestMapping("/api/storage")
@RequiredArgsConstructor
@Validated
public class StorageController {

    private final ObjectProvider<StorageService> storageServiceProvider;
    private final FileValidator fileValidator;
    private final MinioProperties minioProperties;
    private final UserService userService;

    // ==================== 头像相关接口 ====================

    /**
     * 上传用户头像
     * POST /api/storage/avatar/upload
     */
    @PostMapping("/avatar/upload")
    public Result<UploadResponse> uploadAvatar(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Long userId) {

        // 校验文件
        fileValidator.validateAvatarFile(file);

        // 生成对象 Key
        String extension = ObjectKeyGenerator.getExtension(file.getOriginalFilename());
        String objectKey = ObjectKeyGenerator.generateAvatarKey(userId, extension);

        // 上传文件
        String bucket = storageService().getBucketName(BucketType.AVATAR);
        FileInfoResponse fileInfo = storageService().upload(BucketType.AVATAR, file, objectKey, file.getContentType());

        // 生成访问 URL
        String url = storageService().getFileUrl(bucket, objectKey, minioProperties.getUrlExpireMinutes());

        UploadResponse response = UploadResponse.builder()
                .bucket(fileInfo.getBucket())
                .objectKey(fileInfo.getObjectKey())
                .url(url)
                .etag(fileInfo.getEtag())
                .size(fileInfo.getSize())
                .contentType(fileInfo.getContentType())
                .originalFileName(file.getOriginalFilename())
                .build();

        userService.updateAvatar(userId, fileInfo.getBucket(), fileInfo.getObjectKey());
        return Result.success(response);
    }

    // ==================== 文档相关接口 ====================

    /**
     * 上传文档文件（PDF）
     * POST /api/storage/document/upload
     */
    @PostMapping("/document/upload")
    public Result<UploadResponse> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Long userId,
            @RequestParam("bizType") String bizType) {

        // 校验文件
        fileValidator.validateDocumentFile(file);

        // 校验 bizType
        try {
            BizType.fromCode(bizType);
        } catch (IllegalArgumentException e) {
            return Result.error(400, "不支持的业务类型: " + bizType);
        }

        // 生成对象 Key
        String extension = ObjectKeyGenerator.getExtension(file.getOriginalFilename());
        String objectKey = ObjectKeyGenerator.generateDocumentKey(bizType, userId,
                file.getOriginalFilename(), extension);

        // 上传文件
        String bucket = storageService().getBucketName(BucketType.DOCUMENT);
        FileInfoResponse fileInfo = storageService().upload(BucketType.DOCUMENT, file, objectKey, file.getContentType());

        // 生成访问 URL
        String url = storageService().getFileUrl(bucket, objectKey, minioProperties.getUrlExpireMinutes());

        UploadResponse response = UploadResponse.builder()
                .bucket(fileInfo.getBucket())
                .objectKey(fileInfo.getObjectKey())
                .url(url)
                .etag(fileInfo.getEtag())
                .size(fileInfo.getSize())
                .contentType(fileInfo.getContentType())
                .originalFileName(file.getOriginalFilename())
                .build();

        return Result.success(response);
    }

    // ==================== 预签名 URL 接口 ====================

    /**
     * 获取预签名上传 URL
     * POST /api/storage/presigned/upload
     */
    @PostMapping("/presigned/upload")
    public Result<PresignedUrlResponse> getPresignedUploadUrl(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody PresignedUploadRequest request) {

        BucketType bucketType = BucketType.fromConfigKey(request.getBucketType());
        String objectKey = resolveObjectKey(bucketType, userId, request);

        // 获取预签名上传 URL
        PresignedUrlResponse response = storageService().getPresignedUploadUrl(
                bucketType, objectKey, request.getContentType(),
                minioProperties.getPresignedExpireMinutes());

        return Result.success(response);
    }

    /**
     * 获取预签名下载 URL
     * GET /api/storage/presigned/download
     */
    @GetMapping("/presigned/download")
    public Result<PresignedUrlResponse> getPresignedDownloadUrl(
            @AuthenticationPrincipal Long userId,
            @Valid PresignedDownloadRequest request) {
        assertObjectOwner(request.getObjectKey(), userId);

        PresignedUrlResponse response = storageService().getPresignedDownloadUrl(
                request.getBucket(), request.getObjectKey(),
                minioProperties.getPresignedExpireMinutes());

        return Result.success(response);
    }

    // ==================== 文件操作接口 ====================

    /**
     * 删除文件
     * DELETE /api/storage/object
     */
    @DeleteMapping("/object")
    public Result<Void> deleteObject(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody FileInfoRequest request) {
        assertObjectOwner(request.getObjectKey(), userId);
        storageService().remove(request.getBucket(), request.getObjectKey());
        return Result.success();
    }

    /**
     * 获取文件信息
     * GET /api/storage/stat
     */
    @GetMapping("/stat")
    public Result<FileInfoResponse> getFileStat(
            @AuthenticationPrincipal Long userId,
            @Valid FileInfoRequest request) {
        assertObjectOwner(request.getObjectKey(), userId);
        FileInfoResponse fileInfo = storageService().stat(request.getBucket(), request.getObjectKey());
        return Result.success(fileInfo);
    }

    private String resolveObjectKey(BucketType bucketType, Long userId, PresignedUploadRequest request) {
        String extension = ObjectKeyGenerator.getExtension(request.getFileName());
        if (bucketType == BucketType.AVATAR) {
            fileValidator.validateAvatarMetadata(request.getFileName(), request.getContentType());
            return ObjectKeyGenerator.generateAvatarKey(userId, extension);
        }

        fileValidator.validateDocumentMetadata(request.getFileName(), request.getContentType());
        if (!StringUtils.hasText(request.getBizType())) {
            throw new BusinessException(400, "bizType 不能为空");
        }

        try {
            BizType.fromCode(request.getBizType());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(400, "不支持的业务类型: " + request.getBizType());
        }

        return ObjectKeyGenerator.generateDocumentKey(
                request.getBizType(),
                userId,
                request.getFileName(),
                extension
        );
    }

    private void assertObjectOwner(String objectKey, Long userId) {
        if (!ObjectKeyGenerator.belongsToUser(objectKey, userId)) {
            throw new BusinessException(403, "无权访问该文件");
        }
    }

    private StorageService storageService() {
        StorageService storageService = storageServiceProvider.getIfAvailable();
        if (storageService == null) {
            throw new BusinessException(500, "对象存储服务未初始化");
        }
        return storageService;
    }
}
