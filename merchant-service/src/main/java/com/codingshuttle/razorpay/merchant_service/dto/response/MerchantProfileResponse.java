package com.codingshuttle.razorpay.merchant_service.dto.response;

import java.util.UUID;

import com.codingshuttle.razorpay.common_lib.enums.BusinessType;
import com.codingshuttle.razorpay.common_lib.enums.MerchantStatus;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record MerchantProfileResponse(
        UUID id,
        String name,
        String email,
        String contactNumber,
        String businessName,
        BusinessType businessType,
        String websiteUrl,
        MerchantStatus merchantStatus,
        String panId,
        String gstId,
        SettlementAccount settlementAccount,
        boolean settlementAccountConfigured,
        boolean kycComplete
) {
    /** The account number is masked: only the last four digits are ever returned. */
    public record SettlementAccount(String maskedAccountNumber, String ifsc, String accountHolderName) {
    }
}
