package com.nexchat.controller;

import com.nexchat.dto.ChatMessageResponse;
import com.nexchat.dto.GroupCreateRequest;
import com.nexchat.dto.GroupResponse;
import com.nexchat.model.User;
import com.nexchat.service.GroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;

    @PostMapping
    public ResponseEntity<GroupResponse> createGroup(
            @RequestBody GroupCreateRequest request,
            Authentication authentication
    ) {
        User creator = (User) authentication.getPrincipal();
        return ResponseEntity.ok(groupService.createGroup(creator.getId(), request));
    }

    @GetMapping
    public ResponseEntity<List<GroupResponse>> getUserGroups(Authentication authentication) {
        User currentUser = (User) authentication.getPrincipal();
        return ResponseEntity.ok(groupService.getUserGroups(currentUser.getId()));
    }

    @GetMapping("/{groupId}/messages")
    public ResponseEntity<List<ChatMessageResponse>> getGroupMessages(
            @PathVariable Long groupId,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        return ResponseEntity.ok(groupService.getGroupMessages(groupId, currentUser.getId()));
    }

    @PostMapping("/{groupId}/test-message")
    public ResponseEntity<ChatMessageResponse> testSendGroupMessage(
            @PathVariable Long groupId,
            @RequestBody java.util.Map<String, String> body,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        Integer expiresIn = body.containsKey("expiresInSeconds") ? Integer.parseInt(body.get("expiresInSeconds")) : null;
        return ResponseEntity.ok(groupService.saveGroupMessage(currentUser.getId(), groupId, body.get("content"), null, expiresIn, body.get("clientMessageId")));
    }

    @DeleteMapping("/{groupId}/members")
    public ResponseEntity<Void> leaveGroup(
            @PathVariable Long groupId,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        groupService.leaveGroup(groupId, currentUser.getId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{groupId}/members")
    public ResponseEntity<Void> addMembers(
            @PathVariable Long groupId,
            @RequestBody com.nexchat.dto.AddMembersRequest request,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        groupService.addMembers(currentUser.getId(), groupId, request.getMemberIds());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{groupId}/members")
    public ResponseEntity<List<Long>> getGroupMembers(
            @PathVariable Long groupId,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        return ResponseEntity.ok(groupService.getGroupMemberIds(groupId, currentUser.getId()));
    }

    @PutMapping("/{groupId}/manage")
    public ResponseEntity<Void> manageGroup(
            @PathVariable Long groupId,
            @RequestBody com.nexchat.dto.ChatManageRequest request,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        groupService.manageGroup(currentUser.getId(), groupId, request);
        return ResponseEntity.ok().build();
    }
}
