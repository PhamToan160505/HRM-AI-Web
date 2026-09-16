package com.hrm.chat.controller;

import com.hrm.chat.entity.ChatGroup;
import com.hrm.chat.entity.GroupMessage;
import com.hrm.chat.entity.ChatGroupMember;
import com.hrm.chat.repository.ChatGroupMemberRepository;
import com.hrm.chat.repository.ChatGroupRepository;
import com.hrm.chat.repository.GroupMessageRepository;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.exception.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/chat/groups")
@RequiredArgsConstructor
public class ChatGroupController {

    private final ChatGroupRepository chatGroupRepository;
    private final ChatGroupMemberRepository chatGroupMemberRepository;
    private final GroupMessageRepository groupMessageRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMyGroups(Authentication authentication) {
        com.hrm.security.CustomUserDetails userDetails = (com.hrm.security.CustomUserDetails) authentication.getPrincipal();
        Long userId = userDetails.getUserId();

        List<Long> groupIds = chatGroupMemberRepository.findByUserId(userId)
                .stream().map(m -> m.getGroupId()).collect(Collectors.toList());

        List<Map<String, Object>> groups = chatGroupRepository.findAllById(groupIds).stream()
                .map(g -> {
                    long memberCount = chatGroupMemberRepository.countByGroupId(g.getId());
                    ChatGroupMember member = chatGroupMemberRepository.findByGroupIdAndUserId(g.getId(), userId).orElse(null);
                    Long lastReadMessageId = member != null ? member.getLastReadMessageId() : null;
                    
                    GroupMessage latestMsg = groupMessageRepository.findTopByGroupIdOrderByCreatedAtDesc(g.getId()).orElse(null);
                    Long latestMessageId = latestMsg != null ? latestMsg.getId() : null;

                    return Map.<String, Object>of(
                        "id", (Object) g.getId(),
                        "name", (Object) g.getName(),
                        "type", (Object) g.getType().name(),
                        "memberCount", (Object) memberCount,
                        "lastReadMessageId", (Object) (lastReadMessageId != null ? lastReadMessageId : -1L),
                        "latestMessageId", (Object) (latestMessageId != null ? latestMessageId : -1L)
                    );
                }).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok(groups, "Lấy danh sách nhóm chat thành công"));
    }

    @GetMapping("/{groupId}/messages")
    public ResponseEntity<ApiResponse<Page<Map<String, Object>>>> getGroupMessages(
            @PathVariable Long groupId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        
        com.hrm.security.CustomUserDetails userDetails = (com.hrm.security.CustomUserDetails) authentication.getPrincipal();
        Long userId = userDetails.getUserId();

        boolean isMember = chatGroupMemberRepository.findByGroupIdAndUserId(groupId, userId).isPresent();
        if (!isMember) {
            throw new RuntimeException("Bạn không có quyền xem tin nhắn nhóm này");
        }

        Pageable pageable = PageRequest.of(page, size);
        Page<GroupMessage> messages = groupMessageRepository.findGroupMessagesForUser(groupId, userId, pageable);

        Page<Map<String, Object>> response = messages.map(m -> {
            User sender = null;
            String senderRoleDisplay = "";
            if (m.getSenderId() != null) {
                sender = userRepository.findById(m.getSenderId()).orElse(null);
                if (sender != null) {
                    String roleStr = switch (sender.getRole().name()) {
                        case "CEO" -> "CEO";
                        case "GIAM_DOC_PHONG_BAN" -> "Giám đốc";
                        case "TRUONG_PHONG" -> "Trưởng phòng";
                        case "NHAN_VIEN" -> "Nhân viên";
                        default -> "Quản trị viên";
                    };
                    String deptName = "";
                    if (sender.getDepartmentId() != null) {
                        deptName = departmentRepository.findById(sender.getDepartmentId())
                                .map(d -> d.getTenPhong())
                                .orElse("");
                    }
                    if (!deptName.isEmpty() && !roleStr.equals("CEO")) {
                        senderRoleDisplay = roleStr + " " + deptName;
                    } else {
                        senderRoleDisplay = roleStr;
                    }
                }
            }
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", m.getId());
            map.put("groupId", m.getGroupId());
            map.put("senderId", m.getSenderId() != null ? m.getSenderId() : -1);
            map.put("senderName", sender != null ? sender.getHoTen() : (m.isAi() ? "Trợ lý AI" : "Unknown"));
            map.put("senderRole", sender != null ? senderRoleDisplay : (m.isAi() ? "AI Assistant" : ""));
            map.put("senderAvatar", sender != null ? (sender.getAvatarUrl() != null ? sender.getAvatarUrl() : "") : "");
            map.put("privateUserId", m.getPrivateUserId() != null ? m.getPrivateUserId() : -1L);
            map.put("isAi", m.isAi());
            map.put("isRecalled", m.isRecalled());
            map.put("content", m.isRecalled() ? "Tin nhắn đã bị thu hồi" : m.getContent());
            map.put("createdAt", m.getCreatedAt());
            return map;
        });

        return ResponseEntity.ok(ApiResponse.ok(response, "Lấy danh sách tin nhắn thành công"));
    }

    @GetMapping("/{groupId}/members")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getGroupMembers(
            @PathVariable Long groupId,
            Authentication authentication) {

        com.hrm.security.CustomUserDetails userDetails = (com.hrm.security.CustomUserDetails) authentication.getPrincipal();
        Long userId = userDetails.getUserId();

        boolean isMember = chatGroupMemberRepository.findByGroupIdAndUserId(groupId, userId).isPresent();
        if (!isMember) {
            throw new RuntimeException("Bạn không có quyền xem thành viên nhóm này");
        }

        List<Map<String, Object>> members = chatGroupMemberRepository.findByGroupId(groupId).stream()
                .map(m -> {
                    User u = userRepository.findById(m.getUserId()).orElse(null);
                    if (u == null) return null;
                    
                    String roleStr = switch (u.getRole().name()) {
                        case "CEO" -> "CEO";
                        case "GIAM_DOC_PHONG_BAN" -> "Giám đốc";
                        case "TRUONG_PHONG" -> "Trưởng phòng";
                        case "NHAN_VIEN" -> "Nhân viên";
                        default -> "Quản trị viên";
                    };
                    String deptName = "";
                    if (u.getDepartmentId() != null) {
                        deptName = departmentRepository.findById(u.getDepartmentId())
                                .map(d -> d.getTenPhong())
                                .orElse("");
                    }
                    String roleDisplay = (!deptName.isEmpty() && !roleStr.equals("CEO")) ? roleStr + " " + deptName : roleStr;

                    return Map.<String, Object>of(
                            "userId", u.getId(),
                            "hoTen", u.getHoTen(),
                            "role", roleDisplay,
                            "avatarUrl", u.getAvatarUrl() != null ? u.getAvatarUrl() : ""
                    );
                })
                .filter(m -> m != null)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok(members, "Lấy danh sách thành viên thành công"));
    }

    @PostMapping("/{groupId}/read")
    public ResponseEntity<ApiResponse<Void>> markAsRead(
            @PathVariable Long groupId,
            @RequestBody Map<String, Long> payload,
            Authentication authentication) {
        
        com.hrm.security.CustomUserDetails userDetails = (com.hrm.security.CustomUserDetails) authentication.getPrincipal();
        Long userId = userDetails.getUserId();
        
        Long messageId = payload.get("messageId");
        if (messageId == null) {
            throw new RuntimeException("Thiếu messageId");
        }

        ChatGroupMember member = chatGroupMemberRepository.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new RuntimeException("Bạn không phải thành viên nhóm này"));
                
        // Only update if the new messageId is greater than the current one
        if (member.getLastReadMessageId() == null || messageId > member.getLastReadMessageId()) {
            member.setLastReadMessageId(messageId);
            chatGroupMemberRepository.save(member);
        }

        return ResponseEntity.ok(ApiResponse.ok(null, "Đã cập nhật trạng thái đã xem"));
    }
}

