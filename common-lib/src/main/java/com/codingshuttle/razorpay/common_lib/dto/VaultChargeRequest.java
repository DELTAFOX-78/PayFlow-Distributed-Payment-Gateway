package com.codingshuttle.razorpay.common_lib.dto;

import java.util.Map;
import java.util.UUID;

import com.codingshuttle.razorpay.common_lib.entity.Money;

public record VaultChargeRequest(
        UUID paymentId,
        UUID merchantId,
        String token,
        Money amount,
        Map<String, Object> methodDetails
) {
}
