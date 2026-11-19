package com.hrm.tech.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "tech_deployment_logs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechDeploymentLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "environment_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private TechProjectEnvironment environment;

    @Column(name = "version_tag", nullable = false, length = 50)
    private String versionTag;

    @Column(name = "commit_hash", length = 100)
    private String commitHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private TechDeploymentStatus status = TechDeploymentStatus.SUCCESS;

    @Column(name = "changelog", columnDefinition = "TEXT")
    private String changelog;

    @Column(name = "deployed_by", nullable = false)
    private Long deployedBy;

    @Column(name = "deployed_at", nullable = false)
    @Builder.Default
    private LocalDateTime deployedAt = LocalDateTime.now();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}

