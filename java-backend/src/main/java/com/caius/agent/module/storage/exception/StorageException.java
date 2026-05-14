package com.caius.agent.module.storage.exception;

import com.caius.agent.common.exception.BusinessException;

/**
 * 对象存储异常
 */
public class StorageException extends BusinessException {

    public StorageException(String message) {
        super(message);
    }

    public StorageException(Integer code, String message) {
        super(code, message);
    }

    public StorageException(String message, Throwable cause) {
        super(message);
        initCause(cause);
    }
}
