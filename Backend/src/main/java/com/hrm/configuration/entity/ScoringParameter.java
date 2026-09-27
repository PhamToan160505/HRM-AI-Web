package com.hrm.configuration.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

@Entity
@Immutable
@Table(name = "scoring_parameters", uniqueConstraints =
        @UniqueConstraint(name = "uk_scoring_parameter", columnNames = {"scoring_profile_id", "parameter_key"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ScoringParameter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scoring_profile_id", nullable = false)
    private Long scoringProfileId;

    @Column(name = "parameter_key", nullable = false, length = 180)
    private String parameterKey;

    @Column(name = "parameter_value", nullable = false, columnDefinition = "TEXT")
    private String parameterValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "value_type", nullable = false, length = 20)
    private ConfigurationValueType valueType;

    @Column(nullable = false, length = 500)
    private String description;

    private ScoringParameter(
            Long scoringProfileId,
            String parameterKey,
            String parameterValue,
            ConfigurationValueType valueType,
            String description) {
        this.scoringProfileId = scoringProfileId;
        this.parameterKey = parameterKey;
        this.parameterValue = parameterValue;
        this.valueType = valueType;
        this.description = description;
    }

    public static ScoringParameter copyFor(Long profileId, ScoringParameter source, String overriddenValue) {
        return new ScoringParameter(
                profileId,
                source.parameterKey,
                overriddenValue == null ? source.parameterValue : overriddenValue,
                source.valueType,
                source.description);
    }
}
