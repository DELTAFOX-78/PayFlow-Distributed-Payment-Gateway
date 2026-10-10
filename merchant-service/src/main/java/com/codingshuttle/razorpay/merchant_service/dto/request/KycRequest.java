package com.codingshuttle.razorpay.merchant_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record KycRequest(
        @NotBlank(message = "PAN is required")
        @Pattern(regexp = "^[A-Z]{5}[0-9]{4}[A-Z]$", message = "PAN must look like ABCDE1234F")
        String panId,

        @Pattern(regexp = "^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$",
                message = "GSTIN must be a valid 15 character GST number")
        String gstId
) {
}
