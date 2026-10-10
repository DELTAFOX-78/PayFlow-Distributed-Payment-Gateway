package com.codingshuttle.razorpay.operations_service.settlement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SettlementCalculatorTest {

    @Test
    @DisplayName("fee is 2% and GST is 18% of the fee")
    void standardCase() {
        var r = SettlementCalculator.calculate(100_000, 0);

        assertThat(r.feeUnits()).isEqualTo(2_000);
        assertThat(r.gstUnits()).isEqualTo(360);
        assertThat(r.netUnits()).isEqualTo(97_640);
    }

    @Test
    @DisplayName("refunds are deducted before the fee is charged")
    void feeIsChargedOnTheRefundedNetAmount() {
        var r = SettlementCalculator.calculate(100_000, 20_000);

        assertThat(r.feeUnits()).isEqualTo(1_600);
        assertThat(r.gstUnits()).isEqualTo(288);
        assertThat(r.netUnits()).isEqualTo(78_112);
        assertThat(r.refundedUnits()).isEqualTo(20_000);
    }

    @Test
    @DisplayName("amounts are rounded half-up to the nearest paisa")
    void rounding() {
        // 2% of 333 is 6.66 -> 7, and 18% of 7 is 1.26 -> 1
        var r = SettlementCalculator.calculate(333, 0);

        assertThat(r.feeUnits()).isEqualTo(7);
        assertThat(r.gstUnits()).isEqualTo(1);
        assertThat(r.netUnits()).isEqualTo(325);
    }

    @Test
    @DisplayName("a fully refunded amount settles to zero, never negative")
    void fullyRefunded() {
        var r = SettlementCalculator.calculate(5_000, 5_000);

        assertThat(r.netUnits()).isZero();
        assertThat(SettlementCalculator.calculate(5_000, 9_000).netUnits()).isZero();
    }

    @Test
    @DisplayName("gross = refunded + fee + gst + net always holds")
    void conservesMoney() {
        for (int gross = 0; gross <= 50_000; gross += 777) {
            var r = SettlementCalculator.calculate(gross, gross / 4);
            int payable = gross - gross / 4;
            assertThat(r.feeUnits() + r.gstUnits() + r.netUnits()).isEqualTo(payable);
        }
    }

    @Test
    void negativeAmountsAreRejected() {
        assertThatThrownBy(() -> SettlementCalculator.calculate(-1, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
