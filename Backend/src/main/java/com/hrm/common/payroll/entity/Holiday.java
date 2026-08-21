package com.hrm.common.payroll.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Entity
@Table(name = "holidays", uniqueConstraints = @UniqueConstraint(columnNames = "ngay_le"))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Holiday {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ngay_le", nullable = false)
    private LocalDate ngayLe;

    @Column(name = "ten_ngay_le", nullable = false)
    private String tenNgayLe;
}
