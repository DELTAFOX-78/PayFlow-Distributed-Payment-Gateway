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
import com.codingshuttle.razorpay.operations_service.dto.RunSettlementResponse;
import com.codingshuttle.razorpay.operations_service.dto.SettlementResponse;
import com.codingshuttle.razorpay.operations_service.entity.Settlement;
import com.codingshuttle.razorpay.operations_service.service.OperationsQueryService;
import com.codingshuttle.razorpay.operations_service.settlement.SettlementEngine;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/v1/settlements")
@RequiredArgsConstructor
public class SettlementController {

    private final OperationsQueryService queryService;
    private final SettlementEngine settlementEngine;
    private final MerchantContext merchantContext;

    @GetMapping
    public PageResponse<SettlementResponse> list(@RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "20") int size) {
        return queryService.listSettlements(merchantContext.getMerchantId(), page, size);
    }

    @GetMapping("/{settlementId}")
    public SettlementResponse get(@PathVariable UUID settlementId) {
        return queryService.getSettlement(merchantContext.getMerchantId(), settlementId);
    }

    /** Sandbox convenience: settle this merchant now instead of waiting for the nightly run. */
    @PostMapping("/run")
    public RunSettlementResponse run() {
        Settlement settlement = settlementEngine.runForMerchant(merchantContext.getMerchantId());
        if (settlement == null) {
            return new RunSettlementResponse(false, "There are no captured payments waiting to be settled", null);
        }
        return new RunSettlementResponse(true, "Settlement initiated", SettlementResponse.of(settlement, null));
    }
}
