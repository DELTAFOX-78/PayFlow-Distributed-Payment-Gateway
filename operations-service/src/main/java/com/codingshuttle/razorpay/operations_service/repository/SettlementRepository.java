package com.codingshuttle.razorpay.operations_service.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.codingshuttle.razorpay.common_lib.enums.SettlementStatus;
import com.codingshuttle.razorpay.operations_service.entity.Settlement;

public interface SettlementRepository extends JpaRepository<Settlement, UUID> {

    List<Settlement> findByStatus(SettlementStatus settlementStatus);

    Page<Settlement> findByMerchantId(UUID merchantId, Pageable pageable);

    Optional<Settlement> findByIdAndMerchantId(UUID id, UUID merchantId);
}
