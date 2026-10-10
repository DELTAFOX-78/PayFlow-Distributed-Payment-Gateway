package com.codingshuttle.razorpay.payment_service.service;

import java.util.List;
import java.util.UUID;

import com.codingshuttle.razorpay.common_lib.dto.PageResponse;
import com.codingshuttle.razorpay.common_lib.enums.OrderStatus;
import com.codingshuttle.razorpay.common_lib.enums.PaymentMethod;
import com.codingshuttle.razorpay.common_lib.enums.PaymentStatus;
import com.codingshuttle.razorpay.payment_service.dto.response.OrderResponse;
import com.codingshuttle.razorpay.payment_service.dto.response.PaymentResponse;
import com.codingshuttle.razorpay.payment_service.dto.response.PaymentTransitionResponse;

/** Read side for orders and payments; always scoped to one merchant. */
public interface QueryService {

    PageResponse<OrderResponse> listOrders(UUID merchantId, OrderStatus status, int page, int size);

    PageResponse<PaymentResponse> listPayments(UUID merchantId, PaymentStatus status, PaymentMethod method,
                                               UUID orderId, int page, int size);

    PaymentResponse getPayment(UUID merchantId, UUID paymentId);

    List<PaymentTransitionResponse> getTimeline(UUID merchantId, UUID paymentId);
}
