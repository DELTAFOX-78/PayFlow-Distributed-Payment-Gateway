package com.codingshuttle.razorpay.common_lib.exception;

/** Credentials were missing or wrong. Mapped to HTTP 401 without revealing which part failed. */
public class AuthenticationFailedException extends RuntimeException {
    public AuthenticationFailedException(String message) {
        super(message);
    }
}
