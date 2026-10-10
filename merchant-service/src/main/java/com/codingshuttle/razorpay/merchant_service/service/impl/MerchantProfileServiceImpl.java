package com.codingshuttle.razorpay.merchant_service.service.impl;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.codingshuttle.razorpay.common_lib.enums.MerchantStatus;
import com.codingshuttle.razorpay.common_lib.exception.BusinessRuleViolationException;
import com.codingshuttle.razorpay.common_lib.exception.ResourceNotFoundException;
import com.codingshuttle.razorpay.merchant_service.dto.request.KycRequest;
import com.codingshuttle.razorpay.merchant_service.dto.request.SettlementAccountRequest;
import com.codingshuttle.razorpay.merchant_service.dto.request.UpdateProfileRequest;
import com.codingshuttle.razorpay.merchant_service.dto.response.MerchantProfileResponse;
import com.codingshuttle.razorpay.merchant_service.entity.Merchant;
import com.codingshuttle.razorpay.merchant_service.repository.MerchantRepository;
import com.codingshuttle.razorpay.merchant_service.service.MerchantProfileService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
@RequiredArgsConstructor
@Transactional
public class MerchantProfileServiceImpl implements MerchantProfileService {

    private final MerchantRepository merchantRepository;

    @Override
    @Transactional(readOnly = true)
    public MerchantProfileResponse get(UUID merchantId) {
        return toResponse(load(merchantId));
    }

    @Override
    public MerchantProfileResponse update(UUID merchantId, UpdateProfileRequest request) {
        Merchant merchant = load(merchantId);
        if (request.name() != null) merchant.setName(request.name());
        if (request.businessName() != null) merchant.setBusinessName(request.businessName());
        if (request.businessType() != null) merchant.setBusinessType(request.businessType());
        if (request.contactNumber() != null) merchant.setContactNumber(request.contactNumber());
        if (request.websiteUrl() != null) merchant.setWebsiteUrl(request.websiteUrl());
        return toResponse(merchantRepository.save(merchant));
    }

    @Override
    public MerchantProfileResponse saveSettlementAccount(UUID merchantId, SettlementAccountRequest request) {
        Merchant merchant = load(merchantId);
        merchant.setSettlementBankAccount(request.accountNumber());
        merchant.setSettlementBankIfsc(request.ifsc());
        merchant.setSettlementBankAccountHolderName(request.accountHolderName());
        return toResponse(merchantRepository.save(merchant));
    }

    @Override
    public MerchantProfileResponse submitKyc(UUID merchantId, KycRequest request) {
        Merchant merchant = load(merchantId);

        if (merchant.getStatus() == MerchantStatus.SUSPENDED) {
            throw new BusinessRuleViolationException("MERCHANT_SUSPENDED",
                    "A suspended merchant cannot be re-activated through KYC");
        }
        if (!hasSettlementAccount(merchant)) {
            throw new BusinessRuleViolationException("SETTLEMENT_ACCOUNT_REQUIRED",
                    "Add a settlement bank account before completing KYC");
        }

        merchant.setPanId(request.panId());
        if (request.gstId() != null && !request.gstId().isBlank()) {
            merchant.setGstId(request.gstId());
        }
        merchant.setStatus(MerchantStatus.ACTIVE);
        log.info("Merchant {} completed sandbox KYC and is now ACTIVE", merchantId);
        return toResponse(merchantRepository.save(merchant));
    }

    private Merchant load(UUID merchantId) {
        return merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ResourceNotFoundException("Merchant", merchantId));
    }

    private static boolean hasSettlementAccount(Merchant m) {
        return notBlank(m.getSettlementBankAccount()) && notBlank(m.getSettlementBankIfsc())
                && notBlank(m.getSettlementBankAccountHolderName());
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    static String mask(String accountNumber) {
        if (accountNumber == null || accountNumber.length() <= 4) return accountNumber;
        return "*".repeat(accountNumber.length() - 4) + accountNumber.substring(accountNumber.length() - 4);
    }

    private MerchantProfileResponse toResponse(Merchant m) {
        boolean configured = hasSettlementAccount(m);
        return new MerchantProfileResponse(
                m.getId(), m.getName(), m.getEmail(), m.getContactNumber(), m.getBusinessName(),
                m.getBusinessType(), m.getWebsiteUrl(), m.getStatus(), m.getPanId(), m.getGstId(),
                configured
                        ? new MerchantProfileResponse.SettlementAccount(
                                mask(m.getSettlementBankAccount()), m.getSettlementBankIfsc(),
                                m.getSettlementBankAccountHolderName())
                        : null,
                configured,
                m.getStatus() == MerchantStatus.ACTIVE);
    }
}
