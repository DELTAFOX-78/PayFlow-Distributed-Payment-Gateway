package com.codingshuttle.razorpay.payment_service.mapper;

import java.util.List;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

import com.codingshuttle.razorpay.payment_service.dto.response.PaymentResponse;
import com.codingshuttle.razorpay.payment_service.dto.response.PaymentTransitionResponse;
import com.codingshuttle.razorpay.payment_service.dto.response.RefundResponse;
import com.codingshuttle.razorpay.payment_service.entity.Payment;
import com.codingshuttle.razorpay.payment_service.entity.PaymentTransitionLog;
import com.codingshuttle.razorpay.payment_service.entity.Refund;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface PaymentMapper {

    @Mapping(target = "orderId", source = "order.id")
    @Mapping(target = "refundedAmountUnits", ignore = true)
    PaymentResponse toResponse(Payment payment);

    List<PaymentResponse> toResponseList(List<Payment> paymentList);

    @Mapping(target = "paymentId", source = "payment.id")
    RefundResponse toRefundResponse(Refund refund);

    PaymentTransitionResponse toTransitionResponse(PaymentTransitionLog log);
}
