package com.codingshuttle.razorpay.payment_service.dto.request;

import java.util.Map;

import jakarta.validation.constraints.Positive;

/** {@code amountUnits} omitted means "refund whatever is still refundable". */
public record CreateRefundRequest(
        @Positive(message = "Refund amount must be positive")
        Integer amountUnits,
        Map<String, Object> notes
) {
}
