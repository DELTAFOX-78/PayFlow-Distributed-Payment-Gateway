package com.codingshuttle.razorpay.payment_service.service.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.codingshuttle.razorpay.common_lib.dto.PageResponse;
import com.codingshuttle.razorpay.common_lib.enums.OrderStatus;
import com.codingshuttle.razorpay.common_lib.enums.PaymentMethod;
import com.codingshuttle.razorpay.common_lib.enums.PaymentStatus;
import com.codingshuttle.razorpay.common_lib.exception.ResourceNotFoundException;
import com.codingshuttle.razorpay.payment_service.dto.response.OrderResponse;
import com.codingshuttle.razorpay.payment_service.dto.response.PaymentResponse;
import com.codingshuttle.razorpay.payment_service.dto.response.PaymentTransitionResponse;
import com.codingshuttle.razorpay.payment_service.entity.OrderRecord;
import com.codingshuttle.razorpay.payment_service.entity.Payment;
import com.codingshuttle.razorpay.payment_service.mapper.OrderMapper;
import com.codingshuttle.razorpay.payment_service.mapper.PaymentMapper;
import com.codingshuttle.razorpay.payment_service.repository.OrderRepository;
import com.codingshuttle.razorpay.payment_service.repository.PaymentRepository;
import com.codingshuttle.razorpay.payment_service.repository.PaymentTransitionLogRepository;
import com.codingshuttle.razorpay.payment_service.service.QueryService;

import lombok.RequiredArgsConstructor;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class QueryServiceImpl implements QueryService {

    private static final int MAX_PAGE_SIZE = 100;

    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentTransitionLogRepository transitionLogRepository;
    private final OrderMapper orderMapper;
    private final PaymentMapper paymentMapper;
    private final PaymentViewAssembler paymentViewAssembler;

    @Override
    public PageResponse<OrderResponse> listOrders(UUID merchantId, OrderStatus status, int page, int size) {
        Specification<OrderRecord> spec = (root, query, cb) -> cb.equal(root.get("merchantId"), merchantId);
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("orderStatus"), status));
        }
        Page<OrderRecord> result = orderRepository.findAll(spec, pageable(page, size));
        return PageResponse.of(result, orderMapper::toResponse);
    }

    @Override
    public PageResponse<PaymentResponse> listPayments(UUID merchantId, PaymentStatus status, PaymentMethod method,
                                                      UUID orderId, int page, int size) {
        Specification<Payment> spec = (root, query, cb) -> cb.equal(root.get("merchantId"), merchantId);
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (method != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("method"), method));
        }
        if (orderId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("order").get("id"), orderId));
        }
        Page<Payment> result = paymentRepository.findAll(spec, pageable(page, size));
        List<PaymentResponse> items = new ArrayList<>(paymentViewAssembler.toResponses(result.getContent()));
        return new PageResponse<>(items, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    @Override
    public PaymentResponse getPayment(UUID merchantId, UUID paymentId) {
        Payment payment = paymentRepository.findByIdAndMerchantId(paymentId, merchantId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));
        return paymentViewAssembler.toResponse(payment);
    }

    @Override
    public List<PaymentTransitionResponse> getTimeline(UUID merchantId, UUID paymentId) {
        paymentRepository.findByIdAndMerchantId(paymentId, merchantId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));
        return transitionLogRepository.findByPayment_IdOrderByOccurredAtAsc(paymentId).stream()
                .map(paymentMapper::toTransitionResponse).toList();
    }

    private static Pageable pageable(int page, int size) {
        return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "createdAt"));
    }
}
