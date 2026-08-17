package com.hrm.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Custom exception cho lỗi nghiệp vụ — mang theo HttpStatus để GlobalExceptionHandler
 * trả đúng HTTP status code mà không cần if-else phức tạp.
 */
@Getter
public class AppException extends RuntimeException {

    private final HttpStatus status;

    public AppException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    // Factory methods tiện dụng
    public static AppException notFound(String message) {
        return new AppException(HttpStatus.NOT_FOUND, message);
    }

    public static AppException badRequest(String message) {
        return new AppException(HttpStatus.BAD_REQUEST, message);
    }

    public static AppException unauthorized(String message) {
        return new AppException(HttpStatus.UNAUTHORIZED, message);
    }

    public static AppException forbidden(String message) {
        return new AppException(HttpStatus.FORBIDDEN, message);
    }
}
