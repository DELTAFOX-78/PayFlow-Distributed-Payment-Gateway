package com.codingshuttle.razorpay.payment_service.dto.response;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import com.codingshuttle.razorpay.common_lib.entity.Money;
import com.codingshuttle.razorpay.common_lib.enums.PaymentMethod;
import com.codingshuttle.razorpay.common_lib.enums.PaymentStatus;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record PaymentResponse(
        UUID id,
        UUID orderId,
        UUID merchantId,
        Money amount,
        PaymentStatus status,
        PaymentMethod method,
        Map<String, Object> methodDetails,
        String bankReference,
        String errorCode,
        String errorDescription,
        Integer refundedAmountUnits,
        LocalDateTime authorizedAt,
        LocalDateTime capturedAt,
        LocalDateTime settledAt,
        LocalDateTime createdAt
) {
    public PaymentResponse withRefundedAmountUnits(int units) {
        return new PaymentResponse(id, orderId, merchantId, amount, status, method, methodDetails, bankReference,
                errorCode, errorDescription, units, authorizedAt, capturedAt, settledAt, createdAt);
    }
}
