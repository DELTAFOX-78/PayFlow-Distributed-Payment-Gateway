package com.codingshuttle.razorpay.operations_service.settlement;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.codingshuttle.razorpay.common_lib.dto.PaymentSettlementView;
import com.codingshuttle.razorpay.common_lib.dto.SettlementBankDetails;
import com.codingshuttle.razorpay.common_lib.entity.Money;
import com.codingshuttle.razorpay.common_lib.enums.EventAggregateType;
import com.codingshuttle.razorpay.common_lib.enums.SettlementStatus;
import com.codingshuttle.razorpay.common_lib.exception.BusinessRuleViolationException;
import com.codingshuttle.razorpay.common_lib.exception.ResourceNotFoundException;
import com.codingshuttle.razorpay.operations_service.entity.Settlement;
import com.codingshuttle.razorpay.operations_service.entity.SettlementPayment;
import com.codingshuttle.razorpay.operations_service.entity.SettlementPaymentId;
import com.codingshuttle.razorpay.operations_service.outbox.OutboxEventPublisher;
import com.codingshuttle.razorpay.operations_service.repository.SettlementPaymentRepository;
import com.codingshuttle.razorpay.operations_service.repository.SettlementRepository;
import com.codingshuttle.razorpay.operations_service.settlement.dto.BankTransferResult;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class SettlementTransactionExecutor {

    private final SettlementRepository settlementRepository;
    private final SettlementPaymentRepository settlementPaymentRepository;
    private final BankTransferProcessor bankTransferProcessor;
    private final OutboxEventPublisher outboxEventPublisher;
    private final SettlementIntegrationGateway settlementIntegrationGateway;

    /**
     * Settles every captured, unsettled payment of one merchant.
     *
     * @return the created settlement, or {@code null} when there was nothing to settle
     */
    @Transactional
    public Settlement processForMerchant(UUID merchantId, LocalDate settlementDate) {
        List<PaymentSettlementView> unsettledPayments = settlementIntegrationGateway.findUnsettledCaptured(merchantId);
        if (unsettledPayments.isEmpty()) {
            return null;
        }

        SettlementBankDetails bankDetails = settlementIntegrationGateway.getSettlementBankDetails(merchantId);
        if (bankDetails == null || isBlank(bankDetails.accountNumber()) || isBlank(bankDetails.ifsc())) {
            throw new BusinessRuleViolationException("SETTLEMENT_ACCOUNT_REQUIRED",
                    "Add a settlement bank account before running a settlement");
        }

        log.info("Processing {} unsettled payments for merchantId: {} on {}",
                unsettledPayments.size(), merchantId, settlementDate);

        String currency = unsettledPayments.getFirst().currency();
        int grossUnits = unsettledPayments.stream().mapToInt(PaymentSettlementView::amountUnits).sum();
        int refundedUnits = unsettledPayments.stream().mapToInt(PaymentSettlementView::refundedAmountUnits).sum();
        SettlementCalculator.Result amounts = SettlementCalculator.calculate(grossUnits, refundedUnits);

        Settlement settlement = settlementRepository.save(Settlement.builder()
                .merchantId(merchantId)
                .grossAmount(Money.of(amounts.grossUnits(), currency))
                .refundAmount(Money.of(amounts.refundedUnits(), currency))
                .feeAmount(Money.of(amounts.feeUnits(), currency))
                .gstAmount(Money.of(amounts.gstUnits(), currency))
                .netAmount(Money.of(amounts.netUnits(), currency))
                .status(SettlementStatus.INITIATED)
                .build());

        try {
            List<SettlementPayment> links = new ArrayList<>();
            for (PaymentSettlementView p : unsettledPayments) {
                links.add(SettlementPayment.builder()
                        .id(new SettlementPaymentId(settlement.getId(), p.paymentId()))
                        .settlement(settlement)
                        .build());
            }
            settlementPaymentRepository.saveAll(links);

            BankTransferResult transfer = bankTransferProcessor.initiate(settlement.getId(), merchantId,
                    settlement.getNetAmount(), bankDetails.accountNumber(), bankDetails.ifsc());

            settlement.setStatus(SettlementStatus.TRANSFER_PENDING);
            settlement.setBankReference(transfer.registrationRef());
            settlementRepository.save(settlement);
        } catch (Exception e) {
            log.error("Settlement failed for settlementId: {} on date: {}", settlement.getId(), settlementDate, e);
            settlement.setStatus(SettlementStatus.FAILED);
            settlement.setFailureReason(e.getMessage());
            settlementRepository.save(settlement);
        }
        return settlement;
    }

    @Transactional
    public void resolveTransfer(UUID settlementId, String errorCode, String errorDescription) {
        Settlement settlement = settlementRepository.findById(settlementId).orElseThrow(
                () -> new ResourceNotFoundException("Settlement", settlementId));

        if (settlement.getStatus() != SettlementStatus.TRANSFER_PENDING) {
            log.info("Settlement already resolved, skipping id: {}", settlement.getId());
            return;
        }

        if (errorCode == null) {
            settlement.setStatus(SettlementStatus.PROCESSED);
            settlement.setProcessedAt(LocalDateTime.now());
            settlementRepository.save(settlement);

            List<UUID> paymentIds = settlementPaymentRepository.findBySettlement(settlement).stream()
                    .map(SettlementPayment::getId)
                    .map(SettlementPaymentId::getPaymentId)
                    .toList();
            settlementIntegrationGateway.markSettled(paymentIds);

            log.info("Settlement processed successfully, settlementId: {}", settlement.getId());
            publish("SETTLEMENT_PROCESSED", settlement);
        } else {
            settlement.setStatus(SettlementStatus.FAILED);
            settlement.setFailureReason(errorCode + " : " + errorDescription);
            settlementRepository.save(settlement);

            log.warn("Settlement failed, settlementId: {}", settlement.getId());
            publish("SETTLEMENT_FAILED", settlement);
        }
    }

    private void publish(String eventType, Settlement settlement) {
        outboxEventPublisher.publish(EventAggregateType.SETTLEMENT, settlement.getId(), eventType, Map.of(
                "settlementId", settlement.getId().toString(),
                "merchantId", settlement.getMerchantId().toString(),
                "status", settlement.getStatus().name(),
                "settlementAmount", settlement.getNetAmount().getAmountUnits(),
                "settlementCurrency", settlement.getNetAmount().getCurrency()));
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
