package com.codingshuttle.razorpay.operations_service.settlement;

/**
 * Settlement arithmetic, kept free of I/O so it can be unit tested.
 *
 * <p>Fee is 2% of what is actually being paid out (gross minus refunds), and GST is 18% of the fee.
 * Amounts are in minor units (paise) and rounded half-up.
 */
public final class SettlementCalculator {

    static final int FEE_BASIS_POINTS = 200;   // 2.00%
    static final int GST_BASIS_POINTS = 1800;  // 18.00% of the fee

    private SettlementCalculator() {
    }

    public record Result(int grossUnits, int refundedUnits, int feeUnits, int gstUnits, int netUnits) {
    }

    public static Result calculate(int grossUnits, int refundedUnits) {
        if (grossUnits < 0 || refundedUnits < 0) {
            throw new IllegalArgumentException("Amounts cannot be negative");
        }
        int payable = Math.max(grossUnits - refundedUnits, 0);
        int fee = percentOf(payable, FEE_BASIS_POINTS);
        int gst = percentOf(fee, GST_BASIS_POINTS);
        int net = payable - fee - gst;
        return new Result(grossUnits, refundedUnits, fee, gst, net);
    }

    private static int percentOf(int units, int basisPoints) {
        return (int) (((long) units * basisPoints + 5_000L) / 10_000L);
    }
}
