"""结构化日志配置"""
import logging
import sys
from .config import settings


class RequestIdFilter(logging.Filter):
    """请求ID过滤器（预留扩展）"""

    def filter(self, record):
        if not hasattr(record, "request_id"):
            record.request_id = "-"
        return True


def setup_logging() -> None:
    """配置应用日志"""
    log_format = (
        "%(asctime)s | %(levelname)-8s | %(name)s | %(request_id)s | %(message)s"
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestIdFilter())
    handler.setFormatter(logging.Formatter(log_format))

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.DEBUG if settings.debug else logging.INFO)

    # 抑制第三方库的冗余日志
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
