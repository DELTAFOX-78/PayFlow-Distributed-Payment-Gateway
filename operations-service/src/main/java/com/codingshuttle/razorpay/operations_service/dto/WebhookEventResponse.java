package com.codingshuttle.razorpay.operations_service.dto;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import com.codingshuttle.razorpay.common_lib.enums.WebhookEventStatus;
import com.codingshuttle.razorpay.operations_service.entity.WebhookEvent;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record WebhookEventResponse(
        UUID id,
        String eventType,
        String targetUrl,
        WebhookEventStatus status,
        Integer attempts,
        Integer lastResponseCode,
        String lastResponseBody,
        LocalDateTime lastAttemptAt,
        LocalDateTime nextRetryAt,
        LocalDateTime deliveredAt,
        LocalDateTime createdAt,
        Map<String, Object> payload
) {
    public static WebhookEventResponse of(WebhookEvent e, boolean includePayload) {
        return new WebhookEventResponse(e.getId(), e.getEventType(), e.getTargetUrl(), e.getStatus(), e.getAttempts(),
                e.getLastResponseCode(), e.getLastResponseBody(), e.getLastAttemptAt(), e.getNextRetryAt(),
                e.getDeliveredAt(), e.getCreatedAt(), includePayload ? e.getPayload() : null);
    }
}
