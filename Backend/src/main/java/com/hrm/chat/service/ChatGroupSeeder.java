package com.hrm.chat.service;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ChatGroupSeeder implements CommandLineRunner {
    private final ChatGroupService chatGroupService;

    @Override
    public void run(String... args) throws Exception {
        chatGroupService.seedInitialGroups();
    }
}

