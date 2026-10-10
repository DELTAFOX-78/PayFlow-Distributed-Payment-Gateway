package com.codingshuttle.razorpay.operations_service.settlement;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.codingshuttle.razorpay.operations_service.client.MerchantServiceClient;
import com.codingshuttle.razorpay.operations_service.entity.Settlement;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;

@Component
@Slf4j
@RequiredArgsConstructor
public class SettlementEngine {

    private final MerchantServiceClient merchantServiceClient;
    private final SettlementTransactionExecutor settlementTransactionExecutor;

    @Scheduled(cron = "${app.settlement.cron:0 0 23 * * *}")
    @SchedulerLock(name = "operations-service-settlement-engine", lockAtMostFor = "2h", lockAtLeastFor = "1m")
    public void runScheduled() {
        log.info("Nightly settlement running..");
        run();
    }

    /** Settles all active merchants. One merchant failing never blocks the others. */
    public void run() {
        List<UUID> merchantIds = merchantServiceClient.listActiveMerchantIds();
        log.info("Processing the settlement for {} merchantIds", merchantIds.size());

        try (ExecutorService executorService = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<?>> futures = new ArrayList<>();
            for (UUID merchantId : merchantIds) {
                futures.add(executorService.submit(() -> {
                    try {
                        settlementTransactionExecutor.processForMerchant(merchantId, LocalDate.now());
                    } catch (Exception e) {
                        log.error("Settlement failed for merchantId: {}", merchantId, e);
                    }
                }));
            }
            for (Future<?> f : futures) {
                try {
                    f.get();
                } catch (Exception e) {
                    log.error("Settlement batch future failed", e);
                }
            }
        }
        log.info("Settlement batch completed");
    }

    /** On-demand settlement for a single merchant (used by the console's "run settlement" button). */
    public Settlement runForMerchant(UUID merchantId) {
        return settlementTransactionExecutor.processForMerchant(merchantId, LocalDate.now());
    }
}
