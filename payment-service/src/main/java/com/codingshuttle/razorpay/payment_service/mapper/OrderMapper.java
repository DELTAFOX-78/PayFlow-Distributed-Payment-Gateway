package com.codingshuttle.razorpay.payment_service.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

import com.codingshuttle.razorpay.payment_service.dto.response.OrderResponse;
import com.codingshuttle.razorpay.payment_service.entity.OrderRecord;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface OrderMapper {

    @Mapping(target = "status", source = "orderStatus")
    OrderResponse toResponse(OrderRecord orderRecord);
}
