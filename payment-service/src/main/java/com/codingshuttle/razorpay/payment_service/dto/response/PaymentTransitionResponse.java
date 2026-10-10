package com.codingshuttle.razorpay.payment_service.dto.response;

import java.time.LocalDateTime;

import com.codingshuttle.razorpay.common_lib.enums.PaymentActor;
import com.codingshuttle.razorpay.common_lib.enums.PaymentEvent;
import com.codingshuttle.razorpay.common_lib.enums.PaymentStatus;

public record PaymentTransitionResponse(
        PaymentStatus fromStatus,
        PaymentEvent event,
        PaymentStatus toStatus,
        PaymentActor actor,
        LocalDateTime occurredAt
) {
}
