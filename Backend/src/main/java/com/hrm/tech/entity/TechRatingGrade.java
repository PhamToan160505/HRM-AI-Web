package com.hrm.tech.entity;

public enum TechRatingGrade {
    S,
    A,
    B,
    C,
    D;

    public static TechRatingGrade fromScore(double score) {
        if (score >= 90.0) return S;
        if (score >= 80.0) return A;
        if (score >= 65.0) return B;
        if (score >= 50.0) return C;
        return D;
    }

    public String getLabelVi() {
        return switch (this) {
            case S -> "Xuất sắc vượt trội";
            case A -> "Vượt kỳ vọng";
            case B -> "Đạt chuẩn kỹ thuật";
            case C -> "Cần cải thiện";
            case D -> "Chưa đạt yêu cầu";
        };
    }
}
