package com.codingshuttle.razorpay.payment_service.service;

import java.util.List;
import java.util.UUID;

import com.codingshuttle.razorpay.common_lib.dto.PageResponse;
import com.codingshuttle.razorpay.payment_service.dto.request.CreateRefundRequest;
import com.codingshuttle.razorpay.payment_service.dto.response.RefundResponse;

public interface RefundService {

    RefundResponse create(UUID merchantId, UUID paymentId, CreateRefundRequest request);

    List<RefundResponse> listForPayment(UUID merchantId, UUID paymentId);

    PageResponse<RefundResponse> list(UUID merchantId, int page, int size);
}
