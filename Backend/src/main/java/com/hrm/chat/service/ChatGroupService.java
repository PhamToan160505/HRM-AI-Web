package com.hrm.chat.service;

import com.hrm.chat.entity.ChatGroup;
import com.hrm.chat.entity.ChatGroupMember;
import com.hrm.chat.entity.ChatGroupType;
import com.hrm.chat.repository.ChatGroupMemberRepository;
import com.hrm.chat.repository.ChatGroupRepository;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatGroupService {
    private final ChatGroupRepository chatGroupRepository;
    private final ChatGroupMemberRepository chatGroupMemberRepository;
    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;

    @Transactional
    public void seedInitialGroups() {
        log.info("Starting Chat Group Seeder...");

        // 1. Seed Executive Group
        ChatGroup execGroup;
        List<ChatGroup> execGroups = chatGroupRepository.findByType(ChatGroupType.EXECUTIVE);
        if (execGroups.isEmpty()) {
            execGroup = ChatGroup.builder()
                    .name("Ban Giám Đốc")
                    .type(ChatGroupType.EXECUTIVE)
                    .build();
            chatGroupRepository.save(execGroup);
            log.info("Created Executive Chat Group.");
        } else {
            execGroup = execGroups.get(0);
        }

        // Add CEO and Giám Đốc to Executive Group
        List<User> execUsers = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.CEO || u.getRole() == Role.GIAM_DOC_PHONG_BAN)
                .toList();
        for (User user : execUsers) {
            addUserToGroupIfNotExists(execGroup.getId(), user.getId());
        }

        // 2. Seed Department Groups
        List<Department> departments = departmentRepository.findAll();
        for (Department dept : departments) {
            ChatGroup deptGroup;
            Optional<ChatGroup> existingDeptGroup = chatGroupRepository.findByDepartmentId(dept.getId());
            if (existingDeptGroup.isEmpty()) {
                deptGroup = ChatGroup.builder()
                        .name("Phòng " + dept.getTenPhong())
                        .type(ChatGroupType.DEPARTMENT)
                        .departmentId(dept.getId())
                        .build();
                chatGroupRepository.save(deptGroup);
                log.info("Created Chat Group for Department: {}", dept.getTenPhong());
            } else {
                deptGroup = existingDeptGroup.get();
            }

            // Add all users of this department to the group
            List<User> deptUsers = userRepository.findByDepartmentId(dept.getId());
            for (User user : deptUsers) {
                addUserToGroupIfNotExists(deptGroup.getId(), user.getId());
            }
        }
        log.info("Chat Group Seeder Finished.");
    }

    @Transactional
    public void handleNewDepartment(Department department) {
        Optional<ChatGroup> existing = chatGroupRepository.findByDepartmentId(department.getId());
        if (existing.isEmpty()) {
            ChatGroup deptGroup = ChatGroup.builder()
                    .name("Phòng " + department.getTenPhong())
                    .type(ChatGroupType.DEPARTMENT)
                    .departmentId(department.getId())
                    .build();
            chatGroupRepository.save(deptGroup);
            log.info("Auto-created Chat Group for New Department: {}", department.getTenPhong());
        }
    }

    @Transactional
    public void handleNewUser(User user) {
        // If user is CEO or Giám Đốc, add to Executive Group
        if (user.getRole() == Role.CEO || user.getRole() == Role.GIAM_DOC_PHONG_BAN) {
            List<ChatGroup> execGroups = chatGroupRepository.findByType(ChatGroupType.EXECUTIVE);
            if (!execGroups.isEmpty()) {
                addUserToGroupIfNotExists(execGroups.get(0).getId(), user.getId());
            }
        }

        // If user belongs to a department, add to Department Group
        if (user.getDepartmentId() != null) {
            Optional<ChatGroup> deptGroup = chatGroupRepository.findByDepartmentId(user.getDepartmentId());
            if (deptGroup.isPresent()) {
                addUserToGroupIfNotExists(deptGroup.get().getId(), user.getId());
            } else {
                Optional<Department> d = departmentRepository.findById(user.getDepartmentId());
                if(d.isPresent()){
                    ChatGroup newGroup = ChatGroup.builder()
                            .name("Phòng " + d.get().getTenPhong())
                            .type(ChatGroupType.DEPARTMENT)
                            .departmentId(user.getDepartmentId())
                            .build();
                    chatGroupRepository.save(newGroup);
                    addUserToGroupIfNotExists(newGroup.getId(), user.getId());
                }
            }
        }
    }

    private void addUserToGroupIfNotExists(Long groupId, Long userId) {
        Optional<ChatGroupMember> existing = chatGroupMemberRepository.findByGroupIdAndUserId(groupId, userId);
        if (existing.isEmpty()) {
            ChatGroupMember member = ChatGroupMember.builder()
                    .groupId(groupId)
                    .userId(userId)
                    .build();
            chatGroupMemberRepository.save(member);
        }
    }
}

