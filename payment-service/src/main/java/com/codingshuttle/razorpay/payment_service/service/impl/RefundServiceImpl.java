package com.codingshuttle.razorpay.payment_service.service.impl;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.codingshuttle.razorpay.common_lib.dto.PageResponse;
import com.codingshuttle.razorpay.common_lib.entity.Money;
import com.codingshuttle.razorpay.common_lib.enums.EventAggregateType;
import com.codingshuttle.razorpay.common_lib.enums.PaymentEvent;
import com.codingshuttle.razorpay.common_lib.enums.PaymentStatus;
import com.codingshuttle.razorpay.common_lib.enums.RefundStatus;
import com.codingshuttle.razorpay.common_lib.exception.BusinessRuleViolationException;
import com.codingshuttle.razorpay.common_lib.exception.ResourceNotFoundException;
import com.codingshuttle.razorpay.payment_service.dto.request.CreateRefundRequest;
import com.codingshuttle.razorpay.payment_service.dto.response.RefundResponse;
import com.codingshuttle.razorpay.payment_service.entity.Payment;
import com.codingshuttle.razorpay.payment_service.entity.Refund;
import com.codingshuttle.razorpay.payment_service.mapper.PaymentMapper;
import com.codingshuttle.razorpay.payment_service.outbox.OutboxEventPublisher;
import com.codingshuttle.razorpay.payment_service.repository.PaymentRepository;
import com.codingshuttle.razorpay.payment_service.repository.RefundRepository;
import com.codingshuttle.razorpay.payment_service.service.RefundService;
import com.codingshuttle.razorpay.payment_service.statemachine.PaymentTransitionService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
@RequiredArgsConstructor
public class RefundServiceImpl implements RefundService {

    private static final Set<PaymentStatus> REFUNDABLE =
            EnumSet.of(PaymentStatus.CAPTURED, PaymentStatus.SETTLED, PaymentStatus.PARTIALLY_REFUNDED);

    private final PaymentRepository paymentRepository;
    private final RefundRepository refundRepository;
    private final PaymentTransitionService paymentTransitionService;
    private final OutboxEventPublisher eventPublisher;
    private final PaymentMapper paymentMapper;

    @Override
    @Transactional
    public RefundResponse create(UUID merchantId, UUID paymentId, CreateRefundRequest request) {
        Payment payment = paymentRepository.findByIdAndMerchantIdForUpdate(paymentId, merchantId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));

        if (!REFUNDABLE.contains(payment.getStatus())) {
            throw new BusinessRuleViolationException("PAYMENT_NOT_REFUNDABLE",
                    "Payment cannot be refunded in status: " + payment.getStatus());
        }

        long alreadyRefunded = refundRepository.sumActiveByPaymentId(paymentId);
        int remaining = payment.getAmount().getAmountUnits() - (int) alreadyRefunded;
        int amountUnits = request.amountUnits() != null ? request.amountUnits() : remaining;

        if (amountUnits <= 0 || amountUnits > remaining) {
            throw new BusinessRuleViolationException("REFUND_AMOUNT_INVALID",
                    "Refund amount must be between 1 and " + remaining + " (refundable balance)");
        }

        LocalDateTime now = LocalDateTime.now();
        Refund refund = refundRepository.save(Refund.builder()
                .payment(payment)
                .merchantId(merchantId)
                .amount(Money.of(amountUnits, payment.getAmount().getCurrency()))
                .status(RefundStatus.PROCESSED) // the bank is simulated: refunds clear instantly
                .bankReference("RFND-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase())
                .notes(request.notes())
                .processedAt(now)
                .build());

        boolean fullyRefunded = amountUnits == remaining;
        paymentTransitionService.apply(payment,
                fullyRefunded ? PaymentEvent.REFUND_COMPLETE : PaymentEvent.REFUND_INIT);
        if (fullyRefunded) {
            payment.setRefundedAt(now);
        }
        paymentRepository.save(payment);

        eventPublisher.publish(EventAggregateType.REFUND, refund.getId(), "REFUND_CREATED", Map.of(
                "refundId", refund.getId().toString(),
                "paymentId", payment.getId().toString(),
                "orderId", payment.getOrder().getId().toString(),
                "merchantId", merchantId.toString(),
                "refundStatus", refund.getStatus().name(),
                "paymentStatus", payment.getStatus().name(),
                "amountUnits", amountUnits,
                "amountCurrency", refund.getAmount().getCurrency()));

        log.info("Refund {} of {} created for payment {} (fully refunded: {})",
                refund.getId(), amountUnits, paymentId, fullyRefunded);
        return paymentMapper.toRefundResponse(refund);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RefundResponse> listForPayment(UUID merchantId, UUID paymentId) {
        paymentRepository.findByIdAndMerchantId(paymentId, merchantId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));
        return refundRepository.findByPayment_IdAndMerchantIdOrderByCreatedAtDesc(paymentId, merchantId).stream()
                .map(paymentMapper::toRefundResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<RefundResponse> list(UUID merchantId, int page, int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageResponse.of(refundRepository.findByMerchantId(merchantId, pageable),
                paymentMapper::toRefundResponse);
    }
}
