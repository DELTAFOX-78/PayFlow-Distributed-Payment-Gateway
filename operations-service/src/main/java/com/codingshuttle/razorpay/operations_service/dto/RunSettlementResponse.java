package com.codingshuttle.razorpay.operations_service.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record RunSettlementResponse(boolean settled, String message, SettlementResponse settlement) {
}
