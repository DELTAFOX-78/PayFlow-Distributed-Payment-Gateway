package com.codingshuttle.razorpay.common_lib.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

class FixedWindowRateLimiterTest {

    StringRedisTemplate redis;
    ValueOperations<String, String> ops;
    FixedWindowRateLimiter limiter;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        limiter = new FixedWindowRateLimiter(redis);
    }

    @Test
    @DisplayName("the first request opens the window and starts the expiry clock")
    void firstRequest() {
        when(ops.increment("ratelimit:fixed:k")).thenReturn(1L);

        RateLimitResult result = limiter.check("k", 5, 60);

        assertThat(result.isAllowed()).isTrue();
        assertThat(result.remaining()).isEqualTo(4);
        verify(redis).expire("ratelimit:fixed:k", Duration.ofSeconds(60));
    }

    @Test
    @DisplayName("requests over the limit are denied with the time left in the window")
    void overLimit() {
        when(ops.increment("ratelimit:fixed:k")).thenReturn(6L);
        when(redis.getExpire("ratelimit:fixed:k", TimeUnit.SECONDS)).thenReturn(42L);

        RateLimitResult result = limiter.check("k", 5, 60);

        assertThat(result.isAllowed()).isFalse();
        assertThat(result.retryAfterSeconds()).isEqualTo(42);
        verify(redis, never()).expire(any(), eq(Duration.ofSeconds(60)));
    }

    @Test
    @DisplayName("an unknown TTL falls back to the full window instead of throwing")
    void missingTtl() {
        when(ops.increment("ratelimit:fixed:k")).thenReturn(10L);
        when(redis.getExpire("ratelimit:fixed:k", TimeUnit.SECONDS)).thenReturn(null);

        RateLimitResult result = limiter.check("k", 5, 60);

        assertThat(result.isAllowed()).isFalse();
        assertThat(result.retryAfterSeconds()).isEqualTo(60);
    }
}
