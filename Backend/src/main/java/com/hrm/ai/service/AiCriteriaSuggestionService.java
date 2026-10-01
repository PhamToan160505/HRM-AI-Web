package com.hrm.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.configuration.service.ConfigurationService;
import com.hrm.exception.AppException;
import com.hrm.recruitment.controller.RecruitmentController.CriteriaSuggestionRequest;
import com.hrm.recruitment.controller.RecruitmentController.ScreeningCriterionRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AiCriteriaSuggestionService {

    private static final Set<String> SENSITIVE_CRITERIA = Set.of(
            "tuoi", "gioi tinh", "hon nhan", "ton giao", "dan toc", "que quan",
            "ngoai hinh", "chieu cao", "can nang", "khuyet tat", "suc khoe",
            "age", "gender", "marital", "religion", "ethnicity", "disability", "appearance");

    private final GeminiClientService geminiClientService;
    private final ConfigurationService configurationService;
    private final ObjectMapper objectMapper;

    public List<ScreeningCriterionRequest> suggest(CriteriaSuggestionRequest request) {
        if (request == null || isBlank(request.title())) {
            throw AppException.badRequest("Vị trí tuyển dụng là bắt buộc để AI đề xuất tiêu chí");
        }
        if (isBlank(request.description()) && isBlank(request.requirements())) {
            throw AppException.badRequest("Cần có mô tả hoặc yêu cầu công việc để AI đề xuất tiêu chí");
        }

        String prompt = """
                Bạn là chuyên gia xây dựng bộ tiêu chí sàng lọc CV có thể kiểm chứng.
                Hãy tạo từ 3 đến 8 tiêu chí khách quan cho vị trí dưới đây.

                Quy tắc bắt buộc:
                - Chỉ trả về một JSON object, không markdown, không giải thích ngoài JSON.
                - Schema: {"criteria":[{"name":"...","type":"MUST|NICE","weight":20,
                  "synonyms":["..."],"evidenceExpected":"..."}]}.
                - Tổng weight phải bằng 100; mỗi weight là số nguyên dương.
                - MUST chỉ dùng cho yêu cầu thật sự bắt buộc. NICE dùng cho lợi thế.
                - evidenceExpected phải mô tả bằng chứng cụ thể có thể tìm trong CV như dự án,
                  thời gian, phạm vi, công cụ, chứng chỉ, số liệu hoặc kết quả.
                - Không dùng tuổi, giới tính, hôn nhân, tôn giáo, dân tộc, quê quán, ngoại hình,
                  sức khỏe, khuyết tật hoặc thông tin nhạy cảm làm tiêu chí.
                - Không tự suy diễn phẩm chất cá nhân không có bằng chứng.

                Vị trí: %s
                Cấp bậc: %s
                Hình thức làm việc: %s
                Mô tả công việc:
                %s
                Yêu cầu công việc:
                %s
                """.formatted(
                request.title(), value(request.level()), value(request.workMode()),
                value(request.description()), value(request.requirements()));

        String response = geminiClientService.callGemini(
                prompt,
                configurationService.requireInteger("ai.timeout_seconds"),
                configurationService.requireInteger("ai.max_retry")).block();
        String modelText = geminiClientService.extractTextFromGeminiResponse(response);
        JsonNode root = parseJson(modelText);
        JsonNode criteriaNode = root.isArray() ? root : root.path("criteria");
        if (!criteriaNode.isArray() || criteriaNode.size() < 3 || criteriaNode.size() > 8) {
            throw AppException.badRequest("AI phải đề xuất từ 3 đến 8 tiêu chí hợp lệ");
        }

        List<DraftCriterion> drafts = new ArrayList<>();
        for (JsonNode item : criteriaNode) {
            String name = item.path("name").asText("").trim();
            String type = item.path("type").asText("").trim().toUpperCase(Locale.ROOT);
            int weight = item.path("weight").asInt(0);
            String evidenceExpected = item.path("evidenceExpected").asText("").trim();
            if (name.isBlank() || evidenceExpected.isBlank() || weight <= 0
                    || (!"MUST".equals(type) && !"NICE".equals(type))) {
                throw AppException.badRequest("AI trả về tiêu chí chưa đầy đủ hoặc không hợp lệ");
            }
            rejectSensitiveCriterion(name + " " + evidenceExpected);
            List<String> synonyms = new ArrayList<>();
            if (item.path("synonyms").isArray()) {
                item.path("synonyms").forEach(value -> {
                    String synonym = value.asText("").trim();
                    if (!synonym.isBlank() && synonyms.size() < 10) synonyms.add(synonym);
                });
            }
            drafts.add(new DraftCriterion(name, type, weight, synonyms, evidenceExpected));
        }

        int rawTotal = drafts.stream().mapToInt(DraftCriterion::weight).sum();
        List<ScreeningCriterionRequest> normalized = new ArrayList<>();
        int allocated = 0;
        for (int index = 0; index < drafts.size(); index++) {
            DraftCriterion draft = drafts.get(index);
            int remainingItems = drafts.size() - index - 1;
            int weight;
            if (index == drafts.size() - 1) {
                weight = 100 - allocated;
            } else {
                int suggested = Math.max(1, (int) Math.round(draft.weight() * 100.0 / rawTotal));
                weight = Math.min(suggested, 100 - allocated - remainingItems);
            }
            allocated += weight;
            normalized.add(new ScreeningCriterionRequest(
                    "C" + (index + 1), draft.name(), draft.type(), weight,
                    draft.synonyms(), draft.evidenceExpected()));
        }
        return normalized;
    }

    private JsonNode parseJson(String raw) {
        try {
            String clean = raw == null ? "" : raw.trim();
            int start = clean.indexOf('{');
            int arrayStart = clean.indexOf('[');
            if (start < 0 || (arrayStart >= 0 && arrayStart < start)) start = arrayStart;
            int objectEnd = clean.lastIndexOf('}');
            int arrayEnd = clean.lastIndexOf(']');
            int end = Math.max(objectEnd, arrayEnd);
            if (start < 0 || end < start) throw new IllegalArgumentException("missing JSON");
            return objectMapper.readTree(clean.substring(start, end + 1));
        } catch (Exception exception) {
            throw AppException.badRequest("AI không trả về bộ tiêu chí JSON hợp lệ");
        }
    }

    private void rejectSensitiveCriterion(String value) {
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
        if (SENSITIVE_CRITERIA.stream().anyMatch(term -> containsWholeTerm(normalized, term))) {
            throw AppException.badRequest("AI đề xuất tiêu chí nhạy cảm; vui lòng chạy lại hoặc tạo thủ công");
        }
    }

    private boolean containsWholeTerm(String value, String term) {
        return java.util.regex.Pattern.compile(
                        "(^|[^a-z0-9])" + java.util.regex.Pattern.quote(term) + "([^a-z0-9]|$)")
                .matcher(value)
                .find();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String value(String value) {
        return value == null ? "" : value;
    }

    private record DraftCriterion(String name, String type, int weight,
                                  List<String> synonyms, String evidenceExpected) {}
}
