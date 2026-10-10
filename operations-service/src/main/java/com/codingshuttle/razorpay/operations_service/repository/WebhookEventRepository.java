package com.codingshuttle.razorpay.operations_service.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.codingshuttle.razorpay.common_lib.enums.WebhookEventStatus;
import com.codingshuttle.razorpay.operations_service.entity.WebhookEvent;

public interface WebhookEventRepository extends JpaRepository<WebhookEvent, UUID> {

    List<WebhookEvent> findByStatusAndNextRetryAtBefore(WebhookEventStatus webhookEventStatus, LocalDateTime now);

    Page<WebhookEvent> findByMerchantId(UUID merchantId, Pageable pageable);

    Page<WebhookEvent> findByMerchantIdAndStatus(UUID merchantId, WebhookEventStatus status, Pageable pageable);

    Optional<WebhookEvent> findByIdAndMerchantId(UUID id, UUID merchantId);
}
