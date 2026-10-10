package com.codingshuttle.razorpay.payment_service.dto.response;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import com.codingshuttle.razorpay.common_lib.entity.Money;
import com.codingshuttle.razorpay.common_lib.enums.RefundStatus;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record RefundResponse(
        UUID id,
        UUID paymentId,
        UUID merchantId,
        Money amount,
        RefundStatus status,
        String bankReference,
        String errorCode,
        String errorDescription,
        Map<String, Object> notes,
        LocalDateTime processedAt,
        LocalDateTime createdAt
) {
}
