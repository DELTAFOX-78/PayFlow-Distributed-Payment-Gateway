package com.codingshuttle.razorpay.merchant_service.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.codingshuttle.razorpay.common_lib.context.MerchantContext;
import com.codingshuttle.razorpay.merchant_service.dto.request.KycRequest;
import com.codingshuttle.razorpay.merchant_service.dto.request.SettlementAccountRequest;
import com.codingshuttle.razorpay.merchant_service.dto.request.UpdateProfileRequest;
import com.codingshuttle.razorpay.merchant_service.dto.response.MerchantProfileResponse;
import com.codingshuttle.razorpay.merchant_service.service.MerchantProfileService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/v1/merchants/me")
@RequiredArgsConstructor
public class MerchantProfileController {

    private final MerchantProfileService profileService;
    private final MerchantContext merchantContext;

    @GetMapping
    public MerchantProfileResponse get() {
        return profileService.get(merchantContext.getMerchantId());
    }

    @PutMapping
    public MerchantProfileResponse update(@Valid @RequestBody UpdateProfileRequest request) {
        return profileService.update(merchantContext.getMerchantId(), request);
    }

    @PutMapping("/settlement-account")
    public MerchantProfileResponse settlementAccount(@Valid @RequestBody SettlementAccountRequest request) {
        return profileService.saveSettlementAccount(merchantContext.getMerchantId(), request);
    }

    @PostMapping("/kyc")
    public MerchantProfileResponse kyc(@Valid @RequestBody KycRequest request) {
        return profileService.submitKyc(merchantContext.getMerchantId(), request);
    }
}
