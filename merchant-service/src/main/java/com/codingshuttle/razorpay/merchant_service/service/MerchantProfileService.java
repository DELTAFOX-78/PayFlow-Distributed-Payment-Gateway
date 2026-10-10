package com.codingshuttle.razorpay.merchant_service.service;

import java.util.UUID;

import com.codingshuttle.razorpay.merchant_service.dto.request.KycRequest;
import com.codingshuttle.razorpay.merchant_service.dto.request.SettlementAccountRequest;
import com.codingshuttle.razorpay.merchant_service.dto.request.UpdateProfileRequest;
import com.codingshuttle.razorpay.merchant_service.dto.response.MerchantProfileResponse;

public interface MerchantProfileService {

    MerchantProfileResponse get(UUID merchantId);

    MerchantProfileResponse update(UUID merchantId, UpdateProfileRequest request);

    MerchantProfileResponse saveSettlementAccount(UUID merchantId, SettlementAccountRequest request);

    /** Sandbox KYC: a well-formed PAN is accepted instantly and the merchant becomes ACTIVE. */
    MerchantProfileResponse submitKyc(UUID merchantId, KycRequest request);
}
