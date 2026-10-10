package com.codingshuttle.razorpay.payment_service.statemachine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.codingshuttle.razorpay.common_lib.enums.PaymentEvent;
import com.codingshuttle.razorpay.common_lib.enums.PaymentStatus;
import com.codingshuttle.razorpay.common_lib.exception.InvalidStateTransitionException;

class PaymentStateMachineTest {

    private final PaymentStateMachine machine = new PaymentStateMachine();

    @Test
    @DisplayName("the happy path walks CREATED to CAPTURED to SETTLED")
    void happyPath() {
        PaymentStatus s = PaymentStatus.CREATED;
        s = machine.transition(s, PaymentEvent.AUTHORIZE_ATTEMPT);
        assertThat(s).isEqualTo(PaymentStatus.AUTHORIZING);
        s = machine.transition(s, PaymentEvent.AUTHORIZE_SUCCESS);
        assertThat(s).isEqualTo(PaymentStatus.AUTHORIZED);
        s = machine.transition(s, PaymentEvent.CAPTURE_REQUEST);
        assertThat(s).isEqualTo(PaymentStatus.CAPTURING);
        s = machine.transition(s, PaymentEvent.CAPTURE_SUCCESS);
        assertThat(s).isEqualTo(PaymentStatus.CAPTURED);
        s = machine.transition(s, PaymentEvent.SETTLE);
        assertThat(s).isEqualTo(PaymentStatus.SETTLED);
    }

    @Test
    @DisplayName("a declined authorization ends in FAILED")
    void authorizationFailure() {
        assertThat(machine.transition(PaymentStatus.AUTHORIZING, PaymentEvent.AUTHORIZE_FAIL))
                .isEqualTo(PaymentStatus.FAILED);
    }

    @Test
    @DisplayName("a failed capture returns the payment to AUTHORIZED so it can be retried")
    void captureFailureIsRetryable() {
        assertThat(machine.transition(PaymentStatus.CAPTURING, PaymentEvent.CAPTURE_FAIL))
                .isEqualTo(PaymentStatus.AUTHORIZED);
    }

    @Test
    @DisplayName("repeated partial refunds keep the payment PARTIALLY_REFUNDED until it is cleared")
    void multiplePartialRefunds() {
        PaymentStatus s = machine.transition(PaymentStatus.CAPTURED, PaymentEvent.REFUND_INIT);
        assertThat(s).isEqualTo(PaymentStatus.PARTIALLY_REFUNDED);
        s = machine.transition(s, PaymentEvent.REFUND_INIT);
        assertThat(s).isEqualTo(PaymentStatus.PARTIALLY_REFUNDED);
        s = machine.transition(s, PaymentEvent.REFUND_COMPLETE);
        assertThat(s).isEqualTo(PaymentStatus.REFUNDED);
    }

    @Test
    @DisplayName("a settled payment can still be refunded, fully or partially")
    void refundAfterSettlement() {
        assertThat(machine.transition(PaymentStatus.SETTLED, PaymentEvent.REFUND_INIT))
                .isEqualTo(PaymentStatus.PARTIALLY_REFUNDED);
        assertThat(machine.transition(PaymentStatus.SETTLED, PaymentEvent.REFUND_COMPLETE))
                .isEqualTo(PaymentStatus.REFUNDED);
    }

    @Test
    @DisplayName("illegal transitions are rejected")
    void illegalTransitions() {
        assertThatThrownBy(() -> machine.transition(PaymentStatus.FAILED, PaymentEvent.CAPTURE_REQUEST))
                .isInstanceOf(InvalidStateTransitionException.class);
        assertThatThrownBy(() -> machine.transition(PaymentStatus.CREATED, PaymentEvent.REFUND_INIT))
                .isInstanceOf(InvalidStateTransitionException.class);
        assertThatThrownBy(() -> machine.transition(PaymentStatus.REFUNDED, PaymentEvent.REFUND_INIT))
                .isInstanceOf(InvalidStateTransitionException.class);
    }
}
