package com.hrm.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hrm.configuration.service.ConfigurationService;
import com.hrm.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class AiCvScoringService {

    private static final Set<String> FORBIDDEN_MODEL_FIELDS = Set.of(
            "weight", "multiplier", "score", "scores", "grade", "evidence_level", "verified");
    private static final Set<String> SECTIONS = Set.of(
            "EXPERIENCE", "PROJECT", "SKILLS", "TITLE", "EDUCATION", "OTHER");
    private static final Set<String> POLARITIES = Set.of("AFFIRMED", "NEGATED", "UNCLEAR");
    private static final Set<String> DETAIL_TYPES = Set.of("role", "scope", "duration", "metric", "outcome");
    private static final Pattern METRIC_PATTERN = Pattern.compile("(?i)\\b\\d+(?:[.,]\\d+)?\\s*(?:%|percent|triệu|million|k|m|users?|người dùng|requests?|giao dịch)\\b");
    private static final Pattern DURATION_PATTERN = Pattern.compile("(?i)\\b\\d+(?:[.,]\\d+)?\\s*(?:năm|tháng|tuần|ngày|years?|months?|weeks?|days?)\\b");

    private final ObjectMapper objectMapper;
    private final ConfigurationService configurationService;
    private final AiTextSafetyService textSafetyService;

    public ScoringOutcome score(String rawModelOutput, JsonNode criteriaSnapshot, String cvText,
                                String jdText, Long profileId,
                                List<AiTextSafetyService.Flag> preliminaryFlags,
                                ExtractionInfo extraction, MetaInfo meta) {
        JsonNode model = parseStrictModelOutput(rawModelOutput);
        List<Criterion> criteria = parseCriteria(criteriaSnapshot);
        validateModel(model, criteria);

        int ngramSize = configurationService.requireScoringInteger(profileId, "scoring.ngram_n");
        BigDecimal copyThreshold = configurationService.requireScoringDecimal(profileId, "scoring.copy_span_threshold");
        BigDecimal mirrorThreshold = configurationService.requireScoringDecimal(profileId, "scoring.mirroring_warn_threshold");
        BigDecimal listedMultiplier = configurationService.requireScoringDecimal(profileId, "scoring.evidence_multiplier.listed_only");
        BigDecimal mentionedMultiplier = configurationService.requireScoringDecimal(profileId, "scoring.evidence_multiplier.mentioned");
        BigDecimal demonstratedMultiplier = configurationService.requireScoringDecimal(profileId, "scoring.evidence_multiplier.demonstrated");
        BigDecimal unverifiedLimit = configurationService.requireScoringDecimal(profileId,
                "scoring.confidence.unverified_citation_ratio_max");

        List<AiTextSafetyService.Flag> flags = new ArrayList<>(preliminaryFlags);
        ArrayNode computedCriteria = objectMapper.createArrayNode();
        Map<String, JsonNode> evidenceByCriterion = new HashMap<>();
        model.path("criteria_evidence").forEach(item -> evidenceByCriterion.put(item.path("criteria_id").asText(), item));
        List<String> negations = textSafetyService.negationPatterns();
        int totalCitations = 0;
        int unverifiedCitations = 0;
        BigDecimal claimedWeight = BigDecimal.ZERO;
        BigDecimal evidenceWeighted = BigDecimal.ZERO;
        BigDecimal totalWeight = criteria.stream().map(c -> BigDecimal.valueOf(c.weight()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        for (Criterion criterion : criteria) {
            JsonNode proposed = evidenceByCriterion.get(criterion.id());
            ArrayNode verifiedEvidence = objectMapper.createArrayNode();
            EvidenceLevel best = EvidenceLevel.NONE;
            String downgradeReason = null;
            if (proposed != null) {
                for (JsonNode candidate : proposed.path("candidates")) {
                    totalCitations++;
                    String quote = candidate.path("quote").asText();
                    String normalizedQuote = AiTextSafetyService.normalize(quote);
                    boolean verified = !normalizedQuote.isBlank()
                            && AiTextSafetyService.normalize(cvText).contains(normalizedQuote);
                    boolean relevant = verified && mentionsCriterion(normalizedQuote, criterion);
                    if (!verified || !relevant) {
                        unverifiedCitations++;
                        flags.add(new AiTextSafetyService.Flag("UNVERIFIED_CITATION", "CHECK",
                                !verified ? "Trích dẫn không tồn tại nguyên văn trong CV" : "Trích dẫn không nói về tiêu chí " + criterion.name(),
                                "Đối chiếu tiêu chí " + criterion.name() + " trực tiếp trên CV"));
                        continue;
                    }
                    String section = candidate.path("section").asText();
                    String polarity = candidate.path("polarity").asText();
                    if (containsNegation(normalizedQuote, negations)) polarity = "NEGATED";
                    Set<String> details = detailTypes(candidate.path("detail_types"));
                    double overlap = overlapRatio(quote, jdText, ngramSize);
                    boolean copied = BigDecimal.valueOf(overlap).compareTo(copyThreshold) >= 0;
                    EvidenceLevel level = deriveLevel(section, polarity, details, quote, copied);
                    if (copied) {
                        flags.add(new AiTextSafetyService.Flag("EVIDENCE_COPIED_FROM_JD", "CHECK",
                                "Một trích dẫn của tiêu chí " + criterion.name() + " trùng cao với JD",
                                "Yêu cầu ứng viên mô tả ví dụ độc lập và vai trò thực tế"));
                    }
                    if ("NEGATED".equals(polarity)) downgradeReason = "Trích dẫn mang nghĩa phủ định";
                    else if (copied && level == EvidenceLevel.LISTED_ONLY) downgradeReason = "Span trùng JD chỉ được tính tối đa LISTED_ONLY";
                    if (level.rank > best.rank) best = level;

                    ObjectNode evidence = verifiedEvidence.addObject();
                    evidence.put("quote", quote);
                    evidence.put("section", section);
                    evidence.put("polarity", polarity);
                    evidence.put("verified", true);
                    evidence.put("jd_overlap", round(overlap));
                    evidence.put("is_copied_span", copied);
                    ArrayNode detailArray = evidence.putArray("detail_types");
                    details.forEach(detailArray::add);
                }
            }
            BigDecimal multiplier = switch (best) {
                case NONE -> BigDecimal.ZERO;
                case LISTED_ONLY -> listedMultiplier;
                case MENTIONED_IN_EXPERIENCE -> mentionedMultiplier;
                case DEMONSTRATED -> demonstratedMultiplier;
            };
            if (best != EvidenceLevel.NONE) claimedWeight = claimedWeight.add(BigDecimal.valueOf(criterion.weight()));
            evidenceWeighted = evidenceWeighted.add(BigDecimal.valueOf(criterion.weight()).multiply(multiplier));

            ObjectNode result = computedCriteria.addObject();
            result.put("id", criterion.id());
            result.put("name", criterion.name());
            result.put("type", criterion.type());
            result.put("weight", criterion.weight());
            result.put("evidence_level", best.name());
            result.put("multiplier", multiplier);
            result.set("evidence", verifiedEvidence);
            String missing = proposed == null ? "Chưa có bằng chứng được đề xuất" : proposed.path("missing").asText(null);
            if (missing == null) result.putNull("missing"); else result.put("missing", missing);
            if (downgradeReason == null) result.putNull("downgrade_reason"); else result.put("downgrade_reason", downgradeReason);
        }

        BigDecimal claimCoverage = percent(claimedWeight, totalWeight);
        BigDecimal evidenceScore = percent(evidenceWeighted, totalWeight);
        BigDecimal evidenceRatio = claimCoverage.signum() == 0 ? BigDecimal.ZERO
                : evidenceScore.divide(claimCoverage, 4, RoundingMode.HALF_UP);
        String grade = evidenceGrade(profileId, evidenceScore, evidenceRatio);
        BigDecimal unverifiedRatio = totalCitations == 0 ? BigDecimal.ZERO
                : BigDecimal.valueOf(unverifiedCitations).divide(BigDecimal.valueOf(totalCitations), 4, RoundingMode.HALF_UP);

        double documentOverlap = overlapRatio(jdText, cvText, ngramSize);
        if (BigDecimal.valueOf(documentOverlap).compareTo(mirrorThreshold) >= 0) {
            flags.add(new AiTextSafetyService.Flag("JD_MIRRORING_SUSPECTED", "CHECK",
                    "Độ trùng n-gram giữa CV và JD là " + round(documentOverlap),
                    "Yêu cầu ứng viên đưa ra ví dụ công việc cụ thể ngoài câu chữ trong JD"));
        }
        appendConsistencyFlags(model, cvText, flags);

        ObjectNode computed = objectMapper.createObjectNode();
        computed.put("schema_version", "1.2");
        computed.put("status", "DONE");
        ObjectNode extractionNode = computed.putObject("extraction");
        extractionNode.put("quality", extraction.quality());
        extractionNode.put("method", extraction.method());
        extractionNode.put("char_count", extraction.charCount());
        extractionNode.put("hidden_text_removed_chars", extraction.hiddenRemovedChars());
        ObjectNode scores = computed.putObject("scores");
        scores.put("claim_coverage", claimCoverage);
        scores.put("evidence_score", evidenceScore);
        scores.put("evidence_ratio", evidenceRatio);
        scores.put("evidence_grade", grade);
        scores.put("confidence", unverifiedRatio.compareTo(unverifiedLimit) > 0 ? "LOW" : "MEDIUM");
        computed.set("criteria", computedCriteria);
        ArrayNode flagArray = computed.putArray("flags");
        uniqueFlags(flags).forEach(flag -> {
            ObjectNode node = flagArray.addObject();
            node.put("code", flag.code());
            node.put("severity", flag.severity());
            node.put("detail", flag.detail());
            node.put("suggested_question", flag.suggestedQuestion());
            if ("JD_MIRRORING_SUSPECTED".equals(flag.code())) {
                node.putObject("metric").put("ngram_overlap", round(documentOverlap));
            }
        });
        computed.set("verify_points", verifyPoints(computedCriteria, uniqueFlags(flags)));
        ObjectNode metaNode = computed.putObject("meta");
        metaNode.put("model", meta.model());
        metaNode.put("prompt_version", meta.promptVersion());
        metaNode.put("criteria_version", meta.criteriaVersion());
        metaNode.put("scoring_profile_version", meta.scoringProfileVersion());
        metaNode.put("input_hash", meta.inputHash());
        metaNode.put("run_id", meta.runId());
        metaNode.put("duration_ms", meta.durationMs());

        return new ScoringOutcome(model.toString(), computed.toString(), claimCoverage, evidenceScore);
    }

    JsonNode parseStrictModelOutput(String raw) {
        try {
            String clean = raw == null ? "" : raw.trim();
            int start = clean.indexOf('{');
            int end = clean.lastIndexOf('}');
            if (start < 0 || end < start) throw AppException.badRequest("AI không trả về JSON object");
            JsonNode root = objectMapper.readTree(clean.substring(start, end + 1));
            if (!root.isObject()) throw AppException.badRequest("AiModelOutputV1 phải là JSON object");
            rejectForbiddenFields(root);
            if (!"1.0".equals(root.path("schema_version").asText())) {
                throw AppException.badRequest("Sai schema_version của AiModelOutputV1");
            }
            if (!root.path("criteria_evidence").isArray()) {
                throw AppException.badRequest("criteria_evidence phải là mảng");
            }
            return root;
        } catch (AppException exception) {
            throw exception;
        } catch (Exception exception) {
            throw AppException.badRequest("AiModelOutputV1 không hợp lệ");
        }
    }

    private void validateModel(JsonNode model, List<Criterion> criteria) {
        Set<String> known = new HashSet<>();
        criteria.forEach(c -> known.add(c.id()));
        Set<String> seen = new HashSet<>();
        int maxQuotes = configurationService.requireInteger("ai.model.max_quotes_per_criterion");
        int maxQuoteChars = configurationService.requireInteger("ai.model.max_quote_chars");
        for (JsonNode item : model.path("criteria_evidence")) {
            String id = item.path("criteria_id").asText();
            if (!known.contains(id) || !seen.add(id)) {
                throw AppException.badRequest("criteria_id lạ hoặc trùng trong AiModelOutputV1: " + id);
            }
            JsonNode candidates = item.path("candidates");
            if (!candidates.isArray() || candidates.size() > maxQuotes) {
                throw AppException.badRequest("Số trích dẫn vượt giới hạn cho tiêu chí " + id);
            }
            for (JsonNode candidate : candidates) {
                String quote = candidate.path("quote").asText();
                if (quote.isBlank() || quote.length() > maxQuoteChars) {
                    throw AppException.badRequest("Trích dẫn rỗng hoặc quá dài");
                }
                if (!SECTIONS.contains(candidate.path("section").asText())) {
                    throw AppException.badRequest("section không hợp lệ");
                }
                if (!POLARITIES.contains(candidate.path("polarity").asText())) {
                    throw AppException.badRequest("polarity không hợp lệ");
                }
                for (JsonNode detail : candidate.path("detail_types")) {
                    if (!DETAIL_TYPES.contains(detail.asText())) throw AppException.badRequest("detail_type không hợp lệ");
                }
            }
        }
    }

    private void rejectForbiddenFields(JsonNode node) {
        if (node.isObject()) {
            node.fieldNames().forEachRemaining(name -> {
                if (FORBIDDEN_MODEL_FIELDS.contains(name.toLowerCase(Locale.ROOT))) {
                    throw AppException.badRequest("Model không được trả trường tính điểm: " + name);
                }
                rejectForbiddenFields(node.get(name));
            });
        } else if (node.isArray()) node.forEach(this::rejectForbiddenFields);
    }

    private List<Criterion> parseCriteria(JsonNode snapshot) {
        JsonNode array = snapshot.path("criteria");
        if (!array.isArray() || array.isEmpty()) throw AppException.conflict("Criteria version chưa có bộ tiêu chí cấu trúc");
        List<Criterion> criteria = new ArrayList<>();
        int total = 0;
        Set<String> ids = new HashSet<>();
        for (JsonNode node : array) {
            String id = node.path("id").asText();
            int weight = node.path("weight").asInt();
            if (id.isBlank() || !ids.add(id) || weight <= 0) throw AppException.conflict("Bộ tiêu chí không hợp lệ");
            List<String> synonyms = new ArrayList<>();
            node.path("synonyms").forEach(value -> synonyms.add(value.asText()));
            criteria.add(new Criterion(id, node.path("name").asText(), node.path("type").asText(), weight, synonyms));
            total += weight;
        }
        if (total != 100) throw AppException.conflict("Tổng trọng số criteria version phải bằng 100");
        return List.copyOf(criteria);
    }

    private boolean mentionsCriterion(String normalizedQuote, Criterion criterion) {
        if (normalizedQuote.contains(AiTextSafetyService.normalize(criterion.name()))) return true;
        return criterion.synonyms().stream().map(AiTextSafetyService::normalize)
                .filter(value -> !value.isBlank()).anyMatch(normalizedQuote::contains);
    }

    private boolean containsNegation(String normalizedQuote, List<String> negations) {
        return negations.stream().anyMatch(normalizedQuote::contains);
    }

    private Set<String> detailTypes(JsonNode values) {
        Set<String> result = new LinkedHashSet<>();
        if (values.isArray()) values.forEach(value -> result.add(value.asText()));
        return result;
    }

    private EvidenceLevel deriveLevel(String section, String polarity, Set<String> details, String quote, boolean copied) {
        if (!"AFFIRMED".equals(polarity)) return EvidenceLevel.NONE;
        if (copied) return EvidenceLevel.LISTED_ONLY;
        if ("SKILLS".equals(section) || "TITLE".equals(section)) return EvidenceLevel.LISTED_ONLY;
        if (!"EXPERIENCE".equals(section) && !"PROJECT".equals(section)) return EvidenceLevel.LISTED_ONLY;
        boolean concrete = details.stream().anyMatch(detail -> switch (detail) {
            case "metric" -> METRIC_PATTERN.matcher(quote).find();
            case "duration" -> DURATION_PATTERN.matcher(quote).find();
            case "role", "scope", "outcome" -> true;
            default -> false;
        });
        return concrete ? EvidenceLevel.DEMONSTRATED : EvidenceLevel.MENTIONED_IN_EXPERIENCE;
    }

    double overlapRatio(String source, String target, int n) {
        List<String> sourceTokens = tokensWithoutCommonPhrases(source);
        List<String> targetTokens = tokensWithoutCommonPhrases(target);
        Set<String> sourceNgrams = ngrams(sourceTokens, n);
        Set<String> targetNgrams = ngrams(targetTokens, n);
        if (sourceNgrams.isEmpty()) return 0;
        long matches = sourceNgrams.stream().filter(targetNgrams::contains).count();
        return (double) matches / sourceNgrams.size();
    }

    private List<String> tokensWithoutCommonPhrases(String text) {
        String normalized = AiTextSafetyService.normalize(text);
        for (String phrase : configurationService.activeCommonPhrases("vi-VN")) {
            normalized = normalized.replace(AiTextSafetyService.normalize(phrase), " ");
        }
        for (String phrase : configurationService.activeCommonPhrases("en")) {
            normalized = normalized.replace(AiTextSafetyService.normalize(phrase), " ");
        }
        return normalized.isBlank() ? List.of() : Arrays.asList(normalized.trim().split("\\s+"));
    }

    private Set<String> ngrams(List<String> tokens, int n) {
        if (n <= 0 || tokens.size() < n) return Set.of();
        Set<String> result = new LinkedHashSet<>();
        for (int i = 0; i <= tokens.size() - n; i++) result.add(String.join(" ", tokens.subList(i, i + n)));
        return result;
    }

    private String evidenceGrade(Long profileId, BigDecimal score, BigDecimal ratio) {
        BigDecimal lowRatio = configurationService.requireScoringDecimal(profileId, "scoring.evidence_grade.low_ratio");
        BigDecimal highRatio = configurationService.requireScoringDecimal(profileId, "scoring.evidence_grade.high_ratio");
        BigDecimal lowScore = configurationService.requireScoringDecimal(profileId, "scoring.evidence_grade.low_score_max");
        BigDecimal highScore = configurationService.requireScoringDecimal(profileId, "scoring.evidence_grade.high_score_min");
        if (ratio.compareTo(lowRatio) < 0 || score.compareTo(lowScore) < 0) return "LOW";
        if (ratio.compareTo(highRatio) >= 0 && score.compareTo(highScore) >= 0) return "HIGH";
        return "MEDIUM";
    }

    private void appendConsistencyFlags(JsonNode model, String cvText, List<AiTextSafetyService.Flag> flags) {
        int currentYear = java.time.LocalDate.now().getYear();
        java.util.regex.Matcher matcher = Pattern.compile("\\b(20\\d{2})\\b").matcher(cvText);
        while (matcher.find()) {
            int year = Integer.parseInt(matcher.group(1));
            if (year > currentYear) {
                flags.add(new AiTextSafetyService.Flag("FUTURE_DATE", "CHECK",
                        "CV có mốc năm trong tương lai: " + year,
                        "Xác minh lại mốc thời gian " + year));
            }
        }
        for (JsonNode note : model.path("consistency_notes")) {
            String quote = note.path("quote").asText();
            if (!quote.isBlank() && AiTextSafetyService.normalize(cvText).contains(AiTextSafetyService.normalize(quote))) {
                flags.add(new AiTextSafetyService.Flag(note.path("type").asText("CONSISTENCY_CHECK"), "CHECK",
                        note.path("detail").asText("Cần xác minh tính nhất quán"),
                        "Yêu cầu ứng viên giải thích chi tiết mốc hoặc vai trò liên quan"));
            }
        }
    }

    private List<AiTextSafetyService.Flag> uniqueFlags(List<AiTextSafetyService.Flag> flags) {
        Map<String, AiTextSafetyService.Flag> unique = new LinkedHashMap<>();
        flags.forEach(flag -> unique.putIfAbsent(flag.code() + "|" + flag.detail(), flag));
        return List.copyOf(unique.values());
    }

    private ArrayNode verifyPoints(ArrayNode criteria, List<AiTextSafetyService.Flag> flags) {
        int max = configurationService.requireInteger("ai.max_verify_points");
        ArrayNode points = objectMapper.createArrayNode();
        for (JsonNode criterion : criteria) {
            if (points.size() >= max) break;
            boolean must = "MUST".equals(criterion.path("type").asText());
            String level = criterion.path("evidence_level").asText();
            if (must && ("NONE".equals(level) || "LISTED_ONLY".equals(level))) {
                ObjectNode point = points.addObject();
                point.put("claim", criterion.path("name").asText());
                point.put("why", "Tiêu chí MUST chưa có bằng chứng đủ mạnh");
                point.putArray("suggested_questions").add("Bạn có thể mô tả một tình huống thực tế liên quan đến tiêu chí này?");
            }
        }
        for (AiTextSafetyService.Flag flag : flags) {
            if (points.size() >= max) break;
            if (!"CHECK".equals(flag.severity())) continue;
            ObjectNode point = points.addObject();
            point.put("claim", flag.code());
            point.put("why", flag.detail());
            point.putArray("suggested_questions").add(flag.suggestedQuestion());
        }
        return points;
    }

    private BigDecimal percent(BigDecimal numerator, BigDecimal denominator) {
        if (denominator.signum() == 0) return BigDecimal.ZERO;
        return numerator.multiply(BigDecimal.valueOf(100)).divide(denominator, 2, RoundingMode.HALF_UP);
    }

    private double round(double value) { return Math.round(value * 10_000d) / 10_000d; }

    private enum EvidenceLevel {
        NONE(0), LISTED_ONLY(1), MENTIONED_IN_EXPERIENCE(2), DEMONSTRATED(3);
        private final int rank;
        EvidenceLevel(int rank) { this.rank = rank; }
    }

    private record Criterion(String id, String name, String type, int weight, List<String> synonyms) {}
    public record ExtractionInfo(String quality, String method, int charCount, int hiddenRemovedChars) {}
    public record MetaInfo(String model, String promptVersion, long criteriaVersion,
                           long scoringProfileVersion, String inputHash, String runId, long durationMs) {}
    public record ScoringOutcome(String modelOutput, String computedResult,
                                 BigDecimal claimCoverage, BigDecimal evidenceScore) {}
}
