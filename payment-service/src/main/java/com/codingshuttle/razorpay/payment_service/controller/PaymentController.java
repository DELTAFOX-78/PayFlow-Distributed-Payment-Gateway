package com.codingshuttle.razorpay.payment_service.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.codingshuttle.razorpay.common_lib.context.MerchantContext;
import com.codingshuttle.razorpay.common_lib.dto.PageResponse;
import com.codingshuttle.razorpay.common_lib.enums.PaymentMethod;
import com.codingshuttle.razorpay.common_lib.enums.PaymentStatus;
import com.codingshuttle.razorpay.payment_service.dto.request.CreateRefundRequest;
import com.codingshuttle.razorpay.payment_service.dto.request.PaymentInitRequest;
import com.codingshuttle.razorpay.payment_service.dto.response.PaymentResponse;
import com.codingshuttle.razorpay.payment_service.dto.response.PaymentTransitionResponse;
import com.codingshuttle.razorpay.payment_service.dto.response.RefundResponse;
import com.codingshuttle.razorpay.payment_service.service.PaymentService;
import com.codingshuttle.razorpay.payment_service.service.QueryService;
import com.codingshuttle.razorpay.payment_service.service.RefundService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RequestMapping("/v1/payments")
@RestController
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final QueryService queryService;
    private final RefundService refundService;
    private final MerchantContext merchantContext;

    @PostMapping
    public ResponseEntity<PaymentResponse> initiate(@Valid @RequestBody PaymentInitRequest request,
                                                    @RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyKey) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(paymentService.initiate(merchantContext.getMerchantId(), request, idempotencyKey));
    }

    @GetMapping
    public PageResponse<PaymentResponse> list(@RequestParam(required = false) PaymentStatus status,
                                              @RequestParam(required = false) PaymentMethod method,
                                              @RequestParam(required = false) UUID orderId,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "20") int size) {
        return queryService.listPayments(merchantContext.getMerchantId(), status, method, orderId, page, size);
    }

    @GetMapping("/{paymentId}")
    public PaymentResponse get(@PathVariable UUID paymentId) {
        return queryService.getPayment(merchantContext.getMerchantId(), paymentId);
    }

    @GetMapping("/{paymentId}/timeline")
    public List<PaymentTransitionResponse> timeline(@PathVariable UUID paymentId) {
        return queryService.getTimeline(merchantContext.getMerchantId(), paymentId);
    }

    @PostMapping("/{paymentId}/capture")
    public ResponseEntity<PaymentResponse> capture(@PathVariable UUID paymentId) {
        return ResponseEntity.ok(paymentService.capture(merchantContext.getMerchantId(), paymentId));
    }

    @PostMapping("/{paymentId}/refunds")
    public ResponseEntity<RefundResponse> refund(@PathVariable UUID paymentId,
                                                 @Valid @RequestBody(required = false) CreateRefundRequest request) {
        CreateRefundRequest body = request != null ? request : new CreateRefundRequest(null, null);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(refundService.create(merchantContext.getMerchantId(), paymentId, body));
    }

    @GetMapping("/{paymentId}/refunds")
    public List<RefundResponse> refunds(@PathVariable UUID paymentId) {
        return refundService.listForPayment(merchantContext.getMerchantId(), paymentId);
    }
}
