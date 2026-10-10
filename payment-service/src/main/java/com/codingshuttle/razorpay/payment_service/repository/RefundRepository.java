package com.codingshuttle.razorpay.payment_service.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.codingshuttle.razorpay.payment_service.entity.Refund;

public interface RefundRepository extends JpaRepository<Refund, UUID> {

    interface RefundedTotal {
        UUID getPaymentId();

        Long getTotalUnits();
    }

    List<Refund> findByPayment_IdAndMerchantIdOrderByCreatedAtDesc(UUID paymentId, UUID merchantId);

    Page<Refund> findByMerchantId(UUID merchantId, Pageable pageable);

    Optional<Refund> findByIdAndMerchantId(UUID id, UUID merchantId);

    /** Money already refunded (or being refunded) for one payment; failed refunds do not count. */
    @Query("""
            select coalesce(sum(r.amount.amountUnits), 0) from Refund r
            where r.payment.id = :paymentId
              and r.status <> com.codingshuttle.razorpay.common_lib.enums.RefundStatus.FAILED
            """)
    long sumActiveByPaymentId(UUID paymentId);

    @Query("""
            select r.payment.id as paymentId, sum(r.amount.amountUnits) as totalUnits from Refund r
            where r.payment.id in :paymentIds
              and r.status <> com.codingshuttle.razorpay.common_lib.enums.RefundStatus.FAILED
            group by r.payment.id
            """)
    List<RefundedTotal> sumActiveByPaymentIds(Collection<UUID> paymentIds);
}
