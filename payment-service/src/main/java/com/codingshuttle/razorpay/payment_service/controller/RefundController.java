package com.codingshuttle.razorpay.payment_service.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.codingshuttle.razorpay.common_lib.context.MerchantContext;
import com.codingshuttle.razorpay.common_lib.dto.PageResponse;
import com.codingshuttle.razorpay.payment_service.dto.response.RefundResponse;
import com.codingshuttle.razorpay.payment_service.service.RefundService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/v1/refunds")
@RequiredArgsConstructor
public class RefundController {

    private final RefundService refundService;
    private final MerchantContext merchantContext;

    @GetMapping
    public PageResponse<RefundResponse> list(@RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "20") int size) {
        return refundService.list(merchantContext.getMerchantId(), page, size);
    }
}
