package com.hrm.tech.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "tech_project_environments", uniqueConstraints = {
        @UniqueConstraint(name = "uk_proj_env_name", columnNames = {"project_id", "env_name"})
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechProjectEnvironment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private TechProject project;

    @Column(name = "env_name", nullable = false, length = 50)
    private String envName;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(name = "access_url", length = 500)
    private String accessUrl;

    @Column(name = "git_branch", length = 100)
    private String gitBranch;

    @Column(name = "server_host", length = 255)
    private String serverHost;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private TechEnvironmentStatus status = TechEnvironmentStatus.ONLINE;

    @Column(name = "owner_id")
    private Long ownerId;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}

