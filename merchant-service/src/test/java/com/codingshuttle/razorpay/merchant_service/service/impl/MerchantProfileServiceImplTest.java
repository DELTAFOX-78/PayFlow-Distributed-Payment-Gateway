package com.codingshuttle.razorpay.merchant_service.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.codingshuttle.razorpay.common_lib.enums.MerchantStatus;
import com.codingshuttle.razorpay.common_lib.exception.BusinessRuleViolationException;
import com.codingshuttle.razorpay.merchant_service.dto.request.KycRequest;
import com.codingshuttle.razorpay.merchant_service.dto.request.SettlementAccountRequest;
import com.codingshuttle.razorpay.merchant_service.dto.response.MerchantProfileResponse;
import com.codingshuttle.razorpay.merchant_service.entity.Merchant;
import com.codingshuttle.razorpay.merchant_service.repository.MerchantRepository;

class MerchantProfileServiceImplTest {

    final UUID id = UUID.randomUUID();
    MerchantRepository repository;
    MerchantProfileServiceImpl service;
    Merchant merchant;

    @BeforeEach
    void setUp() {
        repository = mock(MerchantRepository.class);
        merchant = Merchant.builder().id(id).name("Asha").email("asha@example.com").build();
        when(repository.findById(id)).thenReturn(Optional.of(merchant));
        when(repository.save(any(Merchant.class))).thenAnswer(inv -> inv.getArgument(0));
        service = new MerchantProfileServiceImpl(repository);
    }

    @Test
    @DisplayName("new merchants start in PENDING_KYC")
    void startsPending() {
        assertThat(service.get(id).merchantStatus()).isEqualTo(MerchantStatus.PENDING_KYC);
        assertThat(service.get(id).kycComplete()).isFalse();
    }

    @Test
    @DisplayName("KYC is refused until a settlement account has been added")
    void kycNeedsSettlementAccount() {
        assertThatThrownBy(() -> service.submitKyc(id, new KycRequest("ABCDE1234F", null)))
                .isInstanceOf(BusinessRuleViolationException.class)
                .extracting(e -> ((BusinessRuleViolationException) e).getErrorCode())
                .isEqualTo("SETTLEMENT_ACCOUNT_REQUIRED");
    }

    @Test
    @DisplayName("completing KYC after adding bank details activates the merchant")
    void kycActivates() {
        service.saveSettlementAccount(id, new SettlementAccountRequest("123456789012", "HDFC0001234", "Asha Verma"));

        MerchantProfileResponse result = service.submitKyc(id, new KycRequest("ABCDE1234F", ""));

        assertThat(result.merchantStatus()).isEqualTo(MerchantStatus.ACTIVE);
        assertThat(result.kycComplete()).isTrue();
        assertThat(result.panId()).isEqualTo("ABCDE1234F");
    }

    @Test
    @DisplayName("the account number is never returned in full")
    void accountNumberIsMasked() {
        MerchantProfileResponse result = service.saveSettlementAccount(id,
                new SettlementAccountRequest("123456789012", "HDFC0001234", "Asha Verma"));

        assertThat(result.settlementAccount().maskedAccountNumber()).isEqualTo("********9012");
        assertThat(result.settlementAccountConfigured()).isTrue();
    }

    @Test
    @DisplayName("a suspended merchant cannot be re-activated")
    void suspendedStaysSuspended() {
        merchant.setStatus(MerchantStatus.SUSPENDED);
        service.saveSettlementAccount(id, new SettlementAccountRequest("123456789012", "HDFC0001234", "Asha Verma"));

        assertThatThrownBy(() -> service.submitKyc(id, new KycRequest("ABCDE1234F", null)))
                .isInstanceOf(BusinessRuleViolationException.class)
                .hasMessageContaining("suspended");
    }
}
