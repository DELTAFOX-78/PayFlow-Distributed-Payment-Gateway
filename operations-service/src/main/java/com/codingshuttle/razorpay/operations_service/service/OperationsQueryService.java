package com.codingshuttle.razorpay.operations_service.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.codingshuttle.razorpay.common_lib.dto.PageResponse;
import com.codingshuttle.razorpay.common_lib.enums.WebhookEventStatus;
import com.codingshuttle.razorpay.common_lib.exception.BusinessRuleViolationException;
import com.codingshuttle.razorpay.common_lib.exception.ResourceNotFoundException;
import com.codingshuttle.razorpay.operations_service.dto.SettlementResponse;
import com.codingshuttle.razorpay.operations_service.dto.WebhookEventResponse;
import com.codingshuttle.razorpay.operations_service.entity.Settlement;
import com.codingshuttle.razorpay.operations_service.entity.SettlementPayment;
import com.codingshuttle.razorpay.operations_service.entity.SettlementPaymentId;
import com.codingshuttle.razorpay.operations_service.entity.WebhookEvent;
import com.codingshuttle.razorpay.operations_service.repository.SettlementPaymentRepository;
import com.codingshuttle.razorpay.operations_service.repository.SettlementRepository;
import com.codingshuttle.razorpay.operations_service.repository.WebhookEventRepository;
import com.codingshuttle.razorpay.operations_service.webhook.WebhookRetryQueue;

import lombok.RequiredArgsConstructor;

/** Merchant-scoped read model for settlements and webhook deliveries, plus webhook replay. */
@Service
@RequiredArgsConstructor
public class OperationsQueryService {

    private final SettlementRepository settlementRepository;
    private final SettlementPaymentRepository settlementPaymentRepository;
    private final WebhookEventRepository webhookEventRepository;
    private final WebhookRetryQueue webhookRetryQueue;

    @Transactional(readOnly = true)
    public PageResponse<SettlementResponse> listSettlements(UUID merchantId, int page, int size) {
        return PageResponse.of(settlementRepository.findByMerchantId(merchantId, pageable(page, size)),
                s -> SettlementResponse.of(s, null));
    }

    @Transactional(readOnly = true)
    public SettlementResponse getSettlement(UUID merchantId, UUID settlementId) {
        Settlement settlement = settlementRepository.findByIdAndMerchantId(settlementId, merchantId)
                .orElseThrow(() -> new ResourceNotFoundException("Settlement", settlementId));
        List<UUID> paymentIds = settlementPaymentRepository.findBySettlement(settlement).stream()
                .map(SettlementPayment::getId).map(SettlementPaymentId::getPaymentId).toList();
        return SettlementResponse.of(settlement, paymentIds);
    }

    @Transactional(readOnly = true)
    public PageResponse<WebhookEventResponse> listWebhookEvents(UUID merchantId, WebhookEventStatus status,
                                                                int page, int size) {
        Pageable pageable = pageable(page, size);
        var result = status == null
                ? webhookEventRepository.findByMerchantId(merchantId, pageable)
                : webhookEventRepository.findByMerchantIdAndStatus(merchantId, status, pageable);
        return PageResponse.of(result, e -> WebhookEventResponse.of(e, false));
    }

    @Transactional(readOnly = true)
    public WebhookEventResponse getWebhookEvent(UUID merchantId, UUID eventId) {
        return WebhookEventResponse.of(load(merchantId, eventId), true);
    }

    /** Puts a failed, dead or already delivered event back on the delivery queue. */
    @Transactional
    public WebhookEventResponse replayWebhookEvent(UUID merchantId, UUID eventId) {
        WebhookEvent event = load(merchantId, eventId);
        if (event.getStatus() == WebhookEventStatus.PENDING) {
            throw new BusinessRuleViolationException("WEBHOOK_ALREADY_QUEUED",
                    "This webhook event is already waiting for delivery");
        }
        event.setStatus(WebhookEventStatus.PENDING);
        event.setAttempts(0);
        event.setNextRetryAt(LocalDateTime.now());
        WebhookEvent saved = webhookEventRepository.save(event);
        webhookRetryQueue.enqueue(saved.getId(), saved.getNextRetryAt());
        return WebhookEventResponse.of(saved, true);
    }

    private WebhookEvent load(UUID merchantId, UUID eventId) {
        return webhookEventRepository.findByIdAndMerchantId(eventId, merchantId)
                .orElseThrow(() -> new ResourceNotFoundException("WebhookEvent", eventId));
    }

    private static Pageable pageable(int page, int size) {
        return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "createdAt"));
    }
}
