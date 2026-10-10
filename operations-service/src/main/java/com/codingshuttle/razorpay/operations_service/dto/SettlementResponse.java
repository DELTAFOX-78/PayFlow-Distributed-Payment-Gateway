package com.codingshuttle.razorpay.operations_service.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.codingshuttle.razorpay.common_lib.entity.Money;
import com.codingshuttle.razorpay.common_lib.enums.SettlementStatus;
import com.codingshuttle.razorpay.operations_service.entity.Settlement;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SettlementResponse(
        UUID id,
        UUID merchantId,
        Money grossAmount,
        Money refundAmount,
        Money feeAmount,
        Money gstAmount,
        Money netAmount,
        SettlementStatus status,
        String bankReference,
        String failureReason,
        LocalDateTime processedAt,
        LocalDateTime createdAt,
        List<UUID> paymentIds
) {
    public static SettlementResponse of(Settlement s, List<UUID> paymentIds) {
        return new SettlementResponse(s.getId(), s.getMerchantId(), s.getGrossAmount(), s.getRefundAmount(),
                s.getFeeAmount(), s.getGstAmount(), s.getNetAmount(), s.getStatus(), s.getBankReference(),
                s.getFailureReason(), s.getProcessedAt(), s.getCreatedAt(), paymentIds);
    }
}
