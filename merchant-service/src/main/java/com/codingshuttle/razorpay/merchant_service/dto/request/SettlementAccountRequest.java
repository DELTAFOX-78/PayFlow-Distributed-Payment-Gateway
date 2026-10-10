package com.codingshuttle.razorpay.merchant_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SettlementAccountRequest(
        @NotBlank(message = "Account number is required")
        @Pattern(regexp = "^[0-9]{9,18}$", message = "Account number must be 9 to 18 digits")
        String accountNumber,

        @NotBlank(message = "IFSC is required")
        @Pattern(regexp = "^[A-Z]{4}0[A-Z0-9]{6}$", message = "IFSC must look like HDFC0001234")
        String ifsc,

        @NotBlank(message = "Account holder name is required")
        @Size(min = 3, max = 200, message = "Account holder name must be 3 to 200 characters")
        String accountHolderName
) {
}
