package com.codingshuttle.razorpay.payment_service.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.codingshuttle.razorpay.payment_service.entity.PaymentTransitionLog;

public interface PaymentTransitionLogRepository extends JpaRepository<PaymentTransitionLog, UUID> {

    List<PaymentTransitionLog> findByPayment_IdOrderByOccurredAtAsc(UUID paymentId);
}
