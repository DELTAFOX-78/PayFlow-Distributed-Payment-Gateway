package com.codingshuttle.razorpay.merchant_service.dto.request;

import com.codingshuttle.razorpay.common_lib.enums.BusinessType;

import jakarta.validation.constraints.Size;

/** Only the fields that are present are changed. */
public record UpdateProfileRequest(
        @Size(min = 2, max = 50, message = "Name must be 2 to 50 characters")
        String name,
        @Size(max = 50, message = "Business name should not be more than 50 characters long")
        String businessName,
        BusinessType businessType,
        @Size(max = 20, message = "Contact number is too long")
        String contactNumber,
        @Size(max = 200, message = "Website URL is too long")
        String websiteUrl
) {
}
