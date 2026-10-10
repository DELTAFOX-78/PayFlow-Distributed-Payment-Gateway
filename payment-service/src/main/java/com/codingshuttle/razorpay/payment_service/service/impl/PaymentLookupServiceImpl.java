package com.codingshuttle.razorpay.payment_service.service.impl;

import com.codingshuttle.razorpay.common_lib.dto.PaymentSettlementView;
import com.codingshuttle.razorpay.common_lib.enums.PaymentStatus;
import com.codingshuttle.razorpay.payment_service.api.PaymentLookupService;
import com.codingshuttle.razorpay.payment_service.entity.Payment;
import com.codingshuttle.razorpay.payment_service.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import com.codingshuttle.razorpay.payment_service.repository.RefundRepository;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentLookupServiceImpl implements PaymentLookupService {

    private final PaymentRepository paymentRepository;
    private final RefundRepository refundRepository;

    @Override
    @Transactional
    public List<PaymentSettlementView> findUnsettledCapturedPayments(UUID merchantId) {
        List<Payment> paymentList = paymentRepository.findSettleableForUpdate(merchantId);
        Map<UUID, Long> refunded = refundRepository
                .sumActiveByPaymentIds(paymentList.stream().map(Payment::getId).toList()).stream()
                .collect(Collectors.toMap(RefundRepository.RefundedTotal::getPaymentId,
                        RefundRepository.RefundedTotal::getTotalUnits));

        return paymentList.stream()
                .map(p -> new PaymentSettlementView(
                        p.getId(),
                        p.getAmount().getAmountUnits(),
                        refunded.getOrDefault(p.getId(), 0L).intValue(),
                        p.getAmount().getCurrency()))
                .toList();
    }

    @Override
    @Transactional
    public void markSettled(List<UUID> paymentList) {
        LocalDateTime now = LocalDateTime.now();
        List<Payment> payments = paymentRepository.findAllById(paymentList);
        for (Payment payment : payments) {
            // A partially refunded payment keeps that status; only fully captured ones become SETTLED.
            if (payment.getStatus() == PaymentStatus.CAPTURED) {
                payment.setStatus(PaymentStatus.SETTLED);
            }
            payment.setSettledAt(now);
        }
        paymentRepository.saveAll(payments);
    }
}













