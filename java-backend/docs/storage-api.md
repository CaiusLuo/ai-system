# 对象存储模块 - 测试文档

## 项目目录结构

```
src/main/java/com/caius/agent/module/storage/
├── controller/
│   └── StorageController.java              # REST API 控制器
├── service/
│   ├── StorageService.java                 # 对象存储接口（抽象层）
│   └── impl/
│       └── MinioStorageServiceImpl.java    # MinIO 实现
├── config/
│   ├── MinioProperties.java                # 配置属性绑定
│   └── MinioConfig.java                    # MinIO 客户端初始化
├── dto/
│   ├── req/
│   │   ├── UploadRequest.java              # 上传请求参数
│   │   ├── PresignedUploadRequest.java     # 预签名上传请求参数
│   │   ├── PresignedDownloadRequest.java   # 预签名下载请求参数
│   │   └── FileInfoRequest.java            # 文件信息查询参数
│   └── resp/
│       ├── UploadResponse.java             # 上传响应
│       ├── PresignedUrlResponse.java       # 预签名 URL 响应
│       └── FileInfoResponse.java           # 文件信息响应
├── enums/
│   ├── BucketType.java                     # Bucket 类型枚举
│   └── BizType.java                        # 业务类型枚举
├── exception/
│   └── StorageException.java               # 对象存储异常
└── util/
    ├── ObjectKeyGenerator.java             # 对象 Key 生成器
    └── FileValidator.java                  # 文件校验工具
```

## 启动前准备

### 1. 启动 MinIO 服务（Docker，可替换为兼容 S3 的 OSS）

```bash
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  --name minio \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

启动后访问 http://127.0.0.1:9001 使用 minioadmin/minioadmin 登录控制台。

### 2. 确认配置

`application-local.yml` 中已包含对象存储配置：

```yaml
storage:
  minio:
    endpoint: ${OSS_ENDPOINT:127.0.0.1:9000}
    secure: ${OSS_SECURE:false}
    access-key: ${OSS_ACCESS_KEY:minioadmin}
    secret-key: ${OSS_SECRET_KEY:minioadmin}
    buckets:
      avatar: ${OSS_BUCKET_AVATAR:avatar}
      document: ${OSS_BUCKET_DOCUMENT:document}
    presigned-expire-minutes: ${OSS_PRESIGNED_EXPIRE_MINUTES:30}
    max-avatar-size: ${OSS_MAX_AVATAR_SIZE:5MB}
    max-document-size: ${OSS_MAX_DOCUMENT_SIZE:20MB}
    url-expire-minutes: ${OSS_URL_EXPIRE_MINUTES:1440}
```

### 3. 启动应用

```bash
mvn spring-boot:run
```

应用启动时会自动检查并创建 `avatar` 和 `document` 两个 Bucket。

> 说明：所有存储接口现在都需要登录态，请求需携带 `Authorization: Bearer <token>`。

---

## API 接口测试

### 1. 上传头像

```bash
curl -X POST http://localhost:8080/api/storage/avatar/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/avatar.jpg"
```

**成功响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "bucket": "avatar",
    "objectKey": "avatar/1001/2026/04/a1b2c3d4e5f6....jpg",
    "url": "http://127.0.0.1:9000/avatar/avatar/1001/2026/04/...?X-Amz-...",
    "etag": "\"d41d8cd98f00b204e9800998ecf8427e\"",
    "size": 102400,
    "contentType": "image/jpeg",
    "originalFileName": "avatar.jpg"
  }
}
```

### 2. 上传 PDF 文档

```bash
curl -X POST http://localhost:8080/api/storage/document/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/resume.pdf" \
  -F "bizType=resume"
```

**成功响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "bucket": "document",
    "objectKey": "document/resume/1001/2026/04/a1b2c3d4-resume.pdf",
    "url": "http://127.0.0.1:9000/document/document/resume/1001/...?X-Amz-...",
    "etag": "\"...\"",
    "size": 524288,
    "contentType": "application/pdf",
    "originalFileName": "resume.pdf"
  }
}
```

### 3. 获取预签名上传 URL

```bash
curl -X POST http://localhost:8080/api/storage/presigned/upload \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "bucketType": "document",
    "bizType": "kb-source",
    "fileName": "knowledge-base.pdf",
    "contentType": "application/pdf"
  }'
```

**成功响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "presignedUrl": "http://127.0.0.1:9000/document/document/kb-source/1001/...?X-Amz-...",
    "objectKey": "document/kb-source/1001/2026/04/...-knowledge-base.pdf",
    "bucket": "document",
    "expireMinutes": 30,
    "method": "PUT"
  }
}
```

**使用预签名 URL 上传文件：**
```bash
curl -X PUT "返回的 presignedUrl" \
  -H "Content-Type: application/pdf" \
  --data-binary "@/path/to/knowledge-base.pdf"
```

### 4. 获取预签名下载 URL

```bash
curl -G http://localhost:8080/api/storage/presigned/download \
  -H "Authorization: Bearer <token>" \
  --data-urlencode "bucket=document" \
  --data-urlencode "objectKey=document/resume/1001/2026/04/...-resume.pdf"
```

**成功响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "presignedUrl": "http://127.0.0.1:9000/document/...?X-Amz-...",
    "objectKey": "document/resume/1001/2026/04/...-resume.pdf",
    "bucket": "document",
    "expireMinutes": 30,
    "method": "GET"
  }
}
```

### 5. 查询文件信息

```bash
curl -G http://localhost:8080/api/storage/stat \
  -H "Authorization: Bearer <token>" \
  --data-urlencode "bucket=avatar" \
  --data-urlencode "objectKey=avatar/1001/2026/04/....jpg"
```

**成功响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "bucket": "avatar",
    "objectKey": "avatar/1001/2026/04/....jpg",
    "size": 102400,
    "contentType": "image/jpeg",
    "etag": "\"d41d8cd98f00b204e9800998ecf8427e\"",
    "lastModified": "2026-04-15T10:30:00Z"
  }
}
```

### 6. 删除文件

```bash
curl -X DELETE http://localhost:8080/api/storage/object \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "bucket": "avatar",
    "objectKey": "avatar/1001/2026/04/e5f7fde66a324f55ba9396234d4e6b1e.jpg"
  }'
```

**成功响应：**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": null
}
```

---

## 错误响应示例

### 文件类型错误
```json
{
  "code": 400,
  "message": "头像文件仅支持以下格式: [jpg, jpeg, png, webp]",
  "data": null
}
```

### 文件过大
```json
{
  "code": 400,
  "message": "头像文件大小超过限制（最大 5MB）",
  "data": null
}
```

### 参数缺失
```json
{
  "code": 400,
  "message": "userId 不能为空",
  "data": null
}
```

---

## 后续演进建议

### 1. 接入 MySQL 保存文件元数据
- 在上传成功后，将 bucket、objectKey、url、userId、bizType、size、contentType 等信息写入 MySQL
- 提供文件列表查询接口，支持按用户、业务类型、时间范围等条件筛选
- 增加软删除机制，避免误删数据

### 2. 接入用户权限校验
- 当前 `/api/storage/**` 为公开接口，后续应加入 JWT 认证
- 确保用户只能操作自己的文件（头像、文档等）
- 管理员可操作所有文件

### 3. 支持分片上传
- 对于大文件（>100MB），使用 MinIO 的分片上传 API
- 实现断点续传功能
- 提供上传进度回调

### 4. 支持切换到腾讯 COS / 阿里 OSS / AWS S3
- 当前已设计 `StorageService` 接口抽象层
- 切换时只需新建一个实现类（如 `CosStorageServiceImpl`、`OssStorageServiceImpl`）
- 通过配置项 `storage.type=minio|cos|oss|s3` 控制使用哪个实现
- 推荐使用 Spring 的 `@ConditionalOnProperty` 自动选择实现

### 5. 支持异步触发 PDF 解析任务
- 上传 PDF 后，发送消息到 MQ（如 RabbitMQ / RocketMQ）
- 由独立的 PDF 解析服务消费消息，提取文本、图片等内容
- 解析结果存入 Elasticsearch / 向量数据库，用于知识库检索

### 6. CDN 加速
- 为公开文件配置 CDN 域名
- 在 `getFileUrl` 方法中返回 CDN 地址而非 MinIO 直连地址

### 7. 图片处理
- 头像上传后生成多尺寸缩略图（如 64x64、128x128、256x256）
- 使用 MinIO 的图片处理 API 或接入云服务的图片处理功能
