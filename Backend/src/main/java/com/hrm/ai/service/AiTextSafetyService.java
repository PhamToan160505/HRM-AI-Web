package com.hrm.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.hrm.configuration.service.ConfigurationService;
import com.hrm.exception.AppException;
import com.hrm.recruitment.entity.Application;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

@Service
@RequiredArgsConstructor
public class AiTextSafetyService {

    private final ConfigurationService configurationService;

    public SafetyResult inspectAndRedact(String visibleText, int hiddenRemovedChars, Application application) {
        String source = visibleText == null ? "" : visibleText;
        String normalizedForPatterns = Normalizer.normalize(source, Normalizer.Form.NFKC);
        List<Flag> flags = new ArrayList<>();

        if (hiddenRemovedChars > 0) {
            flags.add(new Flag("HIDDEN_TEXT_SUSPECTED", "CHECK",
                    "Đã loại " + hiddenRemovedChars + " ký tự ẩn khỏi nội dung dùng để chấm",
                    "Yêu cầu ứng viên cung cấp CV không chứa lớp chữ ẩn"));
        }
        for (ConfigurationService.InjectionRule rule : configurationService.activeInjectionPatterns()) {
            try {
                if (Pattern.compile(rule.pattern(), Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
                        .matcher(normalizedForPatterns).find()) {
                    flags.add(new Flag("PROMPT_INJECTION_PATTERN", "CHECK",
                            "Khớp mẫu an toàn: " + rule.key(),
                            "Xác minh nội dung CV quanh đoạn có chỉ dẫn bất thường"));
                }
            } catch (PatternSyntaxException exception) {
                throw AppException.conflict("Mẫu injection không hợp lệ: " + rule.key());
            }
        }

        List<String> identityMismatches = identityMismatches(source, application);
        if (!identityMismatches.isEmpty()) {
            flags.add(new Flag("IDENTITY_MISMATCH_CHECK", "CHECK",
                    "Không tìm thấy trong CV: " + String.join(", ", identityMismatches),
                    "Xác minh lại thông tin liên hệ với ứng viên"));
        }

        String redacted = source;
        for (ConfigurationService.PatternRule rule : configurationService.activeRedactionRules()) {
            try {
                redacted = Pattern.compile(rule.pattern(), Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
                        .matcher(redacted).replaceAll(rule.replacement());
            } catch (PatternSyntaxException exception) {
                throw AppException.conflict("Mẫu che dữ liệu không hợp lệ: " + rule.key());
            }
        }
        redacted = replaceLiteralIgnoreCase(redacted, application.getFullName(), "[ĐÃ ẨN HỌ TÊN]");
        redacted = replaceLiteralIgnoreCase(redacted, application.getEmail(), "[ĐÃ ẨN EMAIL]");
        redacted = replaceLiteralIgnoreCase(redacted, application.getPhone(), "[ĐÃ ẨN SỐ ĐIỆN THOẠI]");
        return new SafetyResult(redacted, List.copyOf(flags));
    }

    public List<String> negationPatterns() {
        JsonNode configured = configurationService.requireJson("ai.negation_patterns");
        if (!configured.isArray()) throw AppException.conflict("ai.negation_patterns phải là mảng JSON");
        List<String> patterns = new ArrayList<>();
        configured.forEach(node -> {
            if (!node.asText().isBlank()) patterns.add(normalize(node.asText()));
        });
        return List.copyOf(patterns);
    }

    private List<String> identityMismatches(String text, Application application) {
        String normalizedText = normalize(text);
        List<String> mismatches = new ArrayList<>();
        if (!nameMatches(normalizedText, application.getFullName())) mismatches.add("họ tên");
        if (!blank(application.getEmail()) && !normalizedText.contains(normalize(application.getEmail()))) {
            mismatches.add("email");
        }
        String cvDigits = text.replaceAll("\\D", "");
        String phoneDigits = application.getPhone() == null ? "" : application.getPhone().replaceAll("\\D", "");
        if (!phoneDigits.isBlank() && !cvDigits.contains(phoneDigits)) mismatches.add("số điện thoại");
        return mismatches;
    }

    private boolean nameMatches(String normalizedText, String fullName) {
        if (blank(fullName)) return true;
        String[] tokens = normalize(fullName).split(" ");
        for (String token : tokens) {
            if (token.length() > 1 && !normalizedText.contains(token)) return false;
        }
        return true;
    }

    private String replaceLiteralIgnoreCase(String input, String value, String replacement) {
        if (blank(value)) return input;
        return Pattern.compile(Pattern.quote(value), Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
                .matcher(input).replaceAll(replacement);
    }

    public static String normalize(String value) {
        if (value == null) return "";
        String decomposed = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd').replace('Đ', 'D')
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .trim();
        return decomposed.replaceAll("\\s+", " ");
    }

    private boolean blank(String value) { return value == null || value.isBlank(); }

    public record Flag(String code, String severity, String detail, String suggestedQuestion) {}
    public record SafetyResult(String redactedText, List<Flag> flags) {}
}
