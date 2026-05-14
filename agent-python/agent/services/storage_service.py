"""MinIO 存储服务。"""

from __future__ import annotations

import logging
import tempfile
from urllib.parse import urlparse

from minio import Minio
from minio.error import S3Error

from agent.core.exceptions import MinioObjectNotFoundError, PdfDownloadError

logger = logging.getLogger(__name__)


class MinioStorageService:
    """封装 MinIO 文件下载能力。"""

    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        secure: bool = False,
    ):
        normalized_endpoint = endpoint.strip()
        normalized_secure = secure

        if normalized_endpoint.startswith(("http://", "https://")):
            parsed = urlparse(normalized_endpoint)
            normalized_endpoint = parsed.netloc or parsed.path
            if parsed.scheme == "https":
                normalized_secure = True
            elif parsed.scheme == "http":
                normalized_secure = False

        self._client = Minio(
            endpoint=normalized_endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=normalized_secure,
        )

    def download_object_bytes(self, bucket: str, object_key: str) -> bytes:
        """下载对象到内存。"""

        logger.info("Downloading object from MinIO: bucket=%s object_key=%s", bucket, object_key)

        try:
            response = self._client.get_object(bucket_name=bucket, object_name=object_key)
            try:
                content = response.read()
            finally:
                response.close()
                response.release_conn()

            if not content:
                raise PdfDownloadError(
                    message="pdf download failed",
                    detail={"reason": "empty file", "bucket": bucket, "objectKey": object_key},
                )

            return content

        except S3Error as exc:
            if exc.code in {"NoSuchKey", "NoSuchObject", "NoSuchBucket"}:
                raise MinioObjectNotFoundError(
                    message="pdf file not found",
                    detail={"bucket": bucket, "objectKey": object_key},
                ) from exc

            raise PdfDownloadError(
                message="pdf download failed",
                detail={"bucket": bucket, "objectKey": object_key, "error": str(exc)},
            ) from exc

        except MinioObjectNotFoundError:
            raise

        except PdfDownloadError:
            raise

        except Exception as exc:  # noqa: BLE001
            raise PdfDownloadError(
                message="pdf download failed",
                detail={"bucket": bucket, "objectKey": object_key, "error": str(exc)},
            ) from exc

    def download_object_to_tempfile(
        self,
        bucket: str,
        object_key: str,
        suffix: str = ".pdf",
    ) -> str:
        """下载对象到临时文件，返回临时文件路径。"""

        content = self.download_object_bytes(bucket=bucket, object_key=object_key)

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(content)
            temp_file.flush()
            temp_path = temp_file.name

        logger.info("Downloaded object to tempfile: %s", temp_path)
        return temp_path
