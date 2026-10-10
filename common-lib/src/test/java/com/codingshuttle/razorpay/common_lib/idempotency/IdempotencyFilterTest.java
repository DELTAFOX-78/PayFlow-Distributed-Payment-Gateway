package com.codingshuttle.razorpay.common_lib.idempotency;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.HandlerExceptionResolver;

import com.codingshuttle.razorpay.common_lib.context.MerchantContext;
import com.codingshuttle.razorpay.common_lib.exception.IdempotencyConflictException;

import jakarta.servlet.FilterChain;

class IdempotencyFilterTest {

    /** Minimal in-memory store with the same semantics as the Redis one. */
    static class MemoryStore implements IdempotencyStore {
        final Map<String, String> data = new HashMap<>();

        public boolean setIfAbsent(String key, Duration ttl) {
            return data.putIfAbsent(key, IN_PROGRESS) == null;
        }

        public void store(String key, String value, Duration ttl) {
            data.put(key, value);
        }

        public Optional<String> get(String key) {
            return Optional.ofNullable(data.get(key));
        }

        public void delete(String key) {
            data.remove(key);
        }
    }

    MemoryStore store;
    IdempotencyFilter filter;
    AtomicInteger resolvedConflicts;

    @BeforeEach
    void setUp() {
        store = new MemoryStore();
        resolvedConflicts = new AtomicInteger();
        MerchantContext ctx = new MerchantContext();
        ctx.setMerchantId(UUID.fromString("11111111-1111-1111-1111-111111111111"));
        HandlerExceptionResolver resolver = (req, res, handler, ex) -> {
            if (ex instanceof IdempotencyConflictException) resolvedConflicts.incrementAndGet();
            return null;
        };
        filter = new IdempotencyFilter(ctx, store, resolver);
    }

    private MockHttpServletRequest post(String key) {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/v1/payments");
        if (key != null) req.addHeader("X-Idempotency-Key", key);
        return req;
    }

    private FilterChain chainReturning(int status, String body, AtomicInteger calls) {
        return (req, res) -> {
            calls.incrementAndGet();
            ((jakarta.servlet.http.HttpServletResponse) res).setStatus(status);
            res.getWriter().write(body);
        };
    }

    @Test
    @DisplayName("requests without an idempotency key pass straight through")
    void noKey() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(post(null), res, chainReturning(201, "{}", calls));

        assertThat(calls).hasValue(1);
        assertThat(store.data).isEmpty();
    }

    @Test
    @DisplayName("the second request with the same key gets the stored response and never reaches the handler")
    void replay() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        filter.doFilter(post("abc"), new MockHttpServletResponse(), chainReturning(201, "{\"id\":1}", calls));

        MockHttpServletResponse second = new MockHttpServletResponse();
        filter.doFilter(post("abc"), second, chainReturning(201, "{\"id\":2}", calls));

        assertThat(calls).hasValue(1);
        assertThat(second.getStatus()).isEqualTo(201);
        assertThat(second.getContentAsString()).isEqualTo("{\"id\":1}");
    }

    @Test
    @DisplayName("failed responses are not stored, so the client can retry with the same key")
    void failuresAreNotCached() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        filter.doFilter(post("abc"), new MockHttpServletResponse(), chainReturning(500, "{\"error\":1}", calls));
        filter.doFilter(post("abc"), new MockHttpServletResponse(), chainReturning(201, "{\"ok\":1}", calls));

        assertThat(calls).hasValue(2);
    }

    @Test
    @DisplayName("a request that arrives while the first is still running is reported as a conflict")
    void inProgress() throws Exception {
        store.data.put("11111111-1111-1111-1111-111111111111:abc", IdempotencyStore.IN_PROGRESS);
        AtomicInteger calls = new AtomicInteger();

        filter.doFilter(post("abc"), new MockHttpServletResponse(), chainReturning(201, "{}", calls));

        assertThat(calls).hasValue(0);
        assertThat(resolvedConflicts).hasValue(1);
    }

    @Test
    @DisplayName("a corrupt stored value is reported as a conflict instead of crashing the filter")
    void corruptStoredValue() throws IOException {
        store.data.put("11111111-1111-1111-1111-111111111111:abc", "no-separator-here");
        MockHttpServletResponse res = new MockHttpServletResponse();

        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() ->
                filter.doFilter(post("abc"), res, chainReturning(201, "{}", new AtomicInteger())));
        assertThat(resolvedConflicts).hasValue(1);
    }
}
