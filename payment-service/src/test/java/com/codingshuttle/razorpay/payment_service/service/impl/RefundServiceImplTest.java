package com.codingshuttle.razorpay.payment_service.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.codingshuttle.razorpay.common_lib.entity.Money;
import com.codingshuttle.razorpay.common_lib.enums.EventAggregateType;
import com.codingshuttle.razorpay.common_lib.enums.PaymentEvent;
import com.codingshuttle.razorpay.common_lib.enums.PaymentMethod;
import com.codingshuttle.razorpay.common_lib.enums.PaymentStatus;
import com.codingshuttle.razorpay.common_lib.enums.RefundStatus;
import com.codingshuttle.razorpay.common_lib.exception.BusinessRuleViolationException;
import com.codingshuttle.razorpay.common_lib.exception.ResourceNotFoundException;
import com.codingshuttle.razorpay.payment_service.dto.request.CreateRefundRequest;
import com.codingshuttle.razorpay.payment_service.entity.OrderRecord;
import com.codingshuttle.razorpay.payment_service.entity.Payment;
import com.codingshuttle.razorpay.payment_service.entity.Refund;
import com.codingshuttle.razorpay.payment_service.mapper.PaymentMapper;
import com.codingshuttle.razorpay.payment_service.outbox.OutboxEventPublisher;
import com.codingshuttle.razorpay.payment_service.repository.PaymentRepository;
import com.codingshuttle.razorpay.payment_service.repository.RefundRepository;
import com.codingshuttle.razorpay.payment_service.statemachine.PaymentTransitionService;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RefundServiceImplTest {

    @Mock PaymentRepository paymentRepository;
    @Mock RefundRepository refundRepository;
    @Mock PaymentTransitionService transitionService;
    @Mock OutboxEventPublisher eventPublisher;
    @Mock PaymentMapper paymentMapper;

    RefundServiceImpl service;

    final UUID merchantId = UUID.randomUUID();
    final UUID paymentId = UUID.randomUUID();
    Payment payment;

    @BeforeEach
    void setUp() {
        service = new RefundServiceImpl(paymentRepository, refundRepository, transitionService,
                eventPublisher, paymentMapper);
        payment = paymentWithStatus(PaymentStatus.CAPTURED);
        when(paymentRepository.findByIdAndMerchantIdForUpdate(paymentId, merchantId))
                .thenReturn(Optional.of(payment));
        when(refundRepository.save(any(Refund.class))).thenAnswer(inv -> {
            Refund r = inv.getArgument(0);
            r.setId(UUID.randomUUID());
            return r;
        });
        when(refundRepository.sumActiveByPaymentId(paymentId)).thenReturn(0L);
    }

    private Payment paymentWithStatus(PaymentStatus status) {
        return Payment.builder()
                .id(paymentId)
                .merchantId(merchantId)
                .order(OrderRecord.builder().id(UUID.randomUUID()).build())
                .amount(Money.inr(10_000))
                .method(PaymentMethod.CARD)
                .status(status)
                .build();
    }

    @Test
    @DisplayName("a partial refund records the amount and moves the payment to PARTIALLY_REFUNDED")
    void partialRefund() {
        service.create(merchantId, paymentId, new CreateRefundRequest(3_000, null));

        ArgumentCaptor<Refund> saved = ArgumentCaptor.forClass(Refund.class);
        verify(refundRepository).save(saved.capture());
        assertThat(saved.getValue().getAmount().getAmountUnits()).isEqualTo(3_000);
        assertThat(saved.getValue().getStatus()).isEqualTo(RefundStatus.PROCESSED);
        verify(transitionService).apply(payment, PaymentEvent.REFUND_INIT);
        verify(eventPublisher).publish(eq(EventAggregateType.REFUND), any(), eq("REFUND_CREATED"), any(Map.class));
    }

    @Test
    @DisplayName("omitting the amount refunds the whole remaining balance and completes the refund")
    void fullRefundByDefault() {
        when(refundRepository.sumActiveByPaymentId(paymentId)).thenReturn(4_000L);

        service.create(merchantId, paymentId, new CreateRefundRequest(null, null));

        ArgumentCaptor<Refund> saved = ArgumentCaptor.forClass(Refund.class);
        verify(refundRepository).save(saved.capture());
        assertThat(saved.getValue().getAmount().getAmountUnits()).isEqualTo(6_000);
        verify(transitionService).apply(payment, PaymentEvent.REFUND_COMPLETE);
        assertThat(payment.getRefundedAt()).isNotNull();
    }

    @Test
    @DisplayName("refunding more than the remaining balance is rejected")
    void overRefund() {
        when(refundRepository.sumActiveByPaymentId(paymentId)).thenReturn(9_000L);

        assertThatThrownBy(() -> service.create(merchantId, paymentId, new CreateRefundRequest(1_001, null)))
                .isInstanceOf(BusinessRuleViolationException.class)
                .hasMessageContaining("1000");
        verify(refundRepository, never()).save(any(Refund.class));
    }

    @Test
    @DisplayName("only captured, settled or partially refunded payments can be refunded")
    void notRefundable() {
        payment.setStatus(PaymentStatus.AUTHORIZING);

        assertThatThrownBy(() -> service.create(merchantId, paymentId, new CreateRefundRequest(100, null)))
                .isInstanceOf(BusinessRuleViolationException.class)
                .extracting(e -> ((BusinessRuleViolationException) e).getErrorCode())
                .isEqualTo("PAYMENT_NOT_REFUNDABLE");
    }

    @Test
    @DisplayName("a payment of another merchant looks like it does not exist")
    void otherMerchantsPayment() {
        UUID stranger = UUID.randomUUID();
        when(paymentRepository.findByIdAndMerchantIdForUpdate(paymentId, stranger)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(stranger, paymentId, new CreateRefundRequest(100, null)))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
