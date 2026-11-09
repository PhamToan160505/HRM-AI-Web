package com.hrm.tech;

import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.tech.controller.TechProjectController;
import com.hrm.tech.controller.TechSkillController;
import com.hrm.tech.dto.UserSkillResponse;
import com.hrm.tech.entity.ProficiencyLevel;
import com.hrm.tech.entity.SkillCategory;
import com.hrm.tech.entity.TechSkill;
import com.hrm.tech.entity.UserTechSkill;
import com.hrm.tech.repository.TechSkillRepository;
import com.hrm.tech.repository.TechProjectMemberRepository;
import com.hrm.tech.repository.UserTechCertificateRepository;
import com.hrm.tech.repository.UserTechSkillRepository;
import com.hrm.tech.service.TechSkillService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.reflect.Method;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TechModulePermissionTest {

    private final TechSkillRepository skillRepository = mock(TechSkillRepository.class);
    private final UserTechSkillRepository userSkillRepository = mock(UserTechSkillRepository.class);
    private final UserTechCertificateRepository certificateRepository = mock(UserTechCertificateRepository.class);
    private final TechProjectMemberRepository memberRepository = mock(TechProjectMemberRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final DepartmentRepository departmentRepository = mock(DepartmentRepository.class);

    private TechSkillService techSkillService;

    @BeforeEach
    void setUp() {
        techSkillService = new TechSkillService(
                skillRepository,
                userSkillRepository,
                certificateRepository,
                memberRepository,
                userRepository,
                departmentRepository
        );
    }

    @Test
    void ceoAndEmployeeCannotVerifyUserSkill() {
        User ceo = User.builder().id(1L).hoTen("CEO Test").role(Role.CEO).build();
        User employee = User.builder().id(2L).hoTen("Dev Test").role(Role.NHAN_VIEN).build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(ceo));
        when(userRepository.findById(2L)).thenReturn(Optional.of(employee));

        assertThrows(AppException.class, () -> techSkillService.verifyUserSkill(10L, 1L));
        assertThrows(AppException.class, () -> techSkillService.verifyUserSkill(10L, 2L));
    }

    @Test
    void techManagerCanVerifyUserSkill() {
        User manager = User.builder().id(3L).hoTen("Tech Manager").role(Role.TRUONG_PHONG).build();
        TechSkill skill = TechSkill.builder().id(5L).skillName("Java").category(SkillCategory.BACKEND).build();
        UserTechSkill userSkill = UserTechSkill.builder()
                .id(10L)
                .userId(99L)
                .skill(skill)
                .proficiencyLevel(ProficiencyLevel.SENIOR)
                .yearsOfExperience(4.0)
                .isVerified(false)
                .build();

        when(userRepository.findById(3L)).thenReturn(Optional.of(manager));
        when(userSkillRepository.findById(10L)).thenReturn(Optional.of(userSkill));
        when(userSkillRepository.save(any(UserTechSkill.class))).thenAnswer(inv -> inv.getArgument(0));

        UserSkillResponse res = techSkillService.verifyUserSkill(10L, 3L);
        assertTrue(res.getIsVerified());
        assertEquals("Tech Manager", res.getVerifierName());
    }

    @Test
    void techProjectControllerEnforcesExecutiveReadOnlyForCeo() throws NoSuchMethodException {
        assertHasCeo(TechProjectController.class, "getAllProjects", true);
        assertHasCeo(TechProjectController.class, "getBenchEngineers", true);
        assertHasCeo(TechProjectController.class, "getProjectById", true);

        assertHasCeo(TechProjectController.class, "createProject", false);
        assertHasCeo(TechProjectController.class, "updateProject", false);
        assertHasCeo(TechProjectController.class, "deleteProject", false);
        assertHasCeo(TechProjectController.class, "addMember", false);
        assertHasCeo(TechProjectController.class, "updateMember", false);
        assertHasCeo(TechProjectController.class, "removeMember", false);
    }

    @Test
    void techSkillControllerEnforcesExecutiveReadOnlyForCeo() throws NoSuchMethodException {
        assertHasCeo(TechSkillController.class, "getSkillsMatrix", true);
        assertHasCeo(TechSkillController.class, "matchSkills", true);

        assertHasCeo(TechSkillController.class, "createSkill", false);
        assertHasCeo(TechSkillController.class, "verifySkill", false);
    }

    private void assertHasCeo(Class<?> clazz, String methodName, boolean expectedAllowed) {
        Method target = null;
        for (Method m : clazz.getDeclaredMethods()) {
            if (m.getName().equals(methodName)) {
                target = m;
                break;
            }
        }
        assertNotNull(target, "Method not found: " + methodName);
        PreAuthorize pre = target.getAnnotation(PreAuthorize.class);
        assertNotNull(pre, "@PreAuthorize missing on " + methodName);
        boolean containsCeo = pre.value().contains("'CEO'");
        assertEquals(expectedAllowed, containsCeo,
                "Unexpected CEO permission on " + clazz.getSimpleName() + "." + methodName + ": " + pre.value());
    }
}

