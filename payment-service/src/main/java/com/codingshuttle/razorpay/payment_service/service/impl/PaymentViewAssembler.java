package com.codingshuttle.razorpay.payment_service.service.impl;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.codingshuttle.razorpay.payment_service.dto.response.PaymentResponse;
import com.codingshuttle.razorpay.payment_service.entity.Payment;
import com.codingshuttle.razorpay.payment_service.mapper.PaymentMapper;
import com.codingshuttle.razorpay.payment_service.repository.RefundRepository;

import lombok.RequiredArgsConstructor;

/** Builds {@link PaymentResponse}s with the refunded total filled in, using one query for a whole list. */
@Component
@RequiredArgsConstructor
public class PaymentViewAssembler {

    private final PaymentMapper paymentMapper;
    private final RefundRepository refundRepository;

    public PaymentResponse toResponse(Payment payment) {
        return paymentMapper.toResponse(payment)
                .withRefundedAmountUnits((int) refundRepository.sumActiveByPaymentId(payment.getId()));
    }

    public List<PaymentResponse> toResponses(Collection<Payment> payments) {
        if (payments.isEmpty()) return List.of();
        Map<UUID, Long> refunded = refundRepository
                .sumActiveByPaymentIds(payments.stream().map(Payment::getId).toList()).stream()
                .collect(Collectors.toMap(r -> r.getPaymentId(), r -> r.getTotalUnits()));
        return payments.stream()
                .map(p -> paymentMapper.toResponse(p)
                        .withRefundedAmountUnits(refunded.getOrDefault(p.getId(), 0L).intValue()))
                .toList();
    }
}
