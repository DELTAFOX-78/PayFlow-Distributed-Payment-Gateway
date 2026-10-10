package com.codingshuttle.razorpay.operations_service.controller;

import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.codingshuttle.razorpay.common_lib.context.MerchantContext;
import com.codingshuttle.razorpay.common_lib.dto.PageResponse;
import com.codingshuttle.razorpay.common_lib.enums.WebhookEventStatus;
import com.codingshuttle.razorpay.operations_service.dto.WebhookEventResponse;
import com.codingshuttle.razorpay.operations_service.service.OperationsQueryService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/v1/webhook-events")
@RequiredArgsConstructor
public class WebhookEventController {

    private final OperationsQueryService queryService;
    private final MerchantContext merchantContext;

    @GetMapping
    public PageResponse<WebhookEventResponse> list(@RequestParam(required = false) WebhookEventStatus status,
                                                   @RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "20") int size) {
        return queryService.listWebhookEvents(merchantContext.getMerchantId(), status, page, size);
    }

    @GetMapping("/{eventId}")
    public WebhookEventResponse get(@PathVariable UUID eventId) {
        return queryService.getWebhookEvent(merchantContext.getMerchantId(), eventId);
    }

    @PostMapping("/{eventId}/replay")
    public WebhookEventResponse replay(@PathVariable UUID eventId) {
        return queryService.replayWebhookEvent(merchantContext.getMerchantId(), eventId);
    }
}
