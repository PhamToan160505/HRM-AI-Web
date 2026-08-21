package com.hrm.common.payroll.service;

/**
 * Biểu thuế lũy tiến từng phần theo Luật Thuế TNCN 2025 (số 109/2025/QH15)
 * Hiệu lực kỳ tính thuế 2026.
 * Bậc 1: đến 10tr — 5%
 * Bậc 2: trên 10tr đến 30tr — 10%
 * Bậc 3: trên 30tr đến 60tr — 20%
 * Bậc 4: trên 60tr đến 100tr — 30%
 * Bậc 5: trên 100tr — 35%
 */
public class PersonalIncomeTaxCalculator {

    public static double calculate(double thuNhapTinhThue) {
        if (thuNhapTinhThue <= 0) {
            return 0.0;
        }

        double tax = 0.0;
        double remaining = thuNhapTinhThue;

        // Bậc 1: Đến 10 triệu - 5%
        if (remaining > 0) {
            double amountInTier = Math.min(remaining, 10_000_000);
            tax += amountInTier * 0.05;
            remaining -= amountInTier;
        }

        // Bậc 2: Trên 10 triệu đến 30 triệu (khoảng 20 triệu) - 10%
        if (remaining > 0) {
            double amountInTier = Math.min(remaining, 20_000_000);
            tax += amountInTier * 0.10;
            remaining -= amountInTier;
        }

        // Bậc 3: Trên 30 triệu đến 60 triệu (khoảng 30 triệu) - 20%
        if (remaining > 0) {
            double amountInTier = Math.min(remaining, 30_000_000);
            tax += amountInTier * 0.20;
            remaining -= amountInTier;
        }

        // Bậc 4: Trên 60 triệu đến 100 triệu (khoảng 40 triệu) - 30%
        if (remaining > 0) {
            double amountInTier = Math.min(remaining, 40_000_000);
            tax += amountInTier * 0.30;
            remaining -= amountInTier;
        }

        // Bậc 5: Trên 100 triệu - 35%
        if (remaining > 0) {
            tax += remaining * 0.35;
        }

        return tax;
    }
}
