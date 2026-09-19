package com.nexchat.controller;

import com.nexchat.model.User;
import com.nexchat.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.nexchat.repository.ProfileRepository;
import com.nexchat.dto.UpdateProfileRequest;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final com.nexchat.service.PresenceService presenceService;

    @GetMapping
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getAllUsers(Authentication authentication) {
        User currentUser = (User) authentication.getPrincipal();
        java.util.Set<Long> blockedIds = currentUser.getProfile() != null ? currentUser.getProfile().getBlockedUserIds() : new java.util.HashSet<>();
        
        List<Map<String, Object>> users = userRepository.findAll().stream()
                .filter(u -> !u.getId().equals(currentUser.getId()))
                .map(u -> Map.of(
                        "id", (Object) u.getId(),
                        "email", u.getEmail(),
                        "fullName", u.getProfile() != null ? u.getProfile().getFullName() : "",
                        "online", (u.getProfile() != null && u.getProfile().isShowOnlineStatus()) ? presenceService.isUserOnline(u.getId()) : false,
                        "lastSeen", (u.getProfile() != null && u.getProfile().isShowLastSeen() && u.getProfile().getLastSeen() != null) ? u.getProfile().getLastSeen().toString() : "",
                        "isBlocked", blockedIds.contains(u.getId()),
                        "publicKey", u.getPublicKey() != null ? u.getPublicKey() : "",
                        "bio", u.getProfile() != null && u.getProfile().getBio() != null ? u.getProfile().getBio() : "",
                        "statusMessage", u.getProfile() != null && u.getProfile().getStatusMessage() != null ? u.getProfile().getStatusMessage() : "",
                        "avatarUrl", u.getProfile() != null && u.getProfile().getAvatarUrl() != null ? u.getProfile().getAvatarUrl() : ""
                ))
                .collect(Collectors.toList());
                
        return ResponseEntity.ok(users);
    }
    
    @PostMapping("/{userId}/block")
    public ResponseEntity<Void> blockUser(@PathVariable Long userId, Authentication authentication) {
        User currentUser = (User) authentication.getPrincipal();
        if (currentUser.getProfile() != null) {
            currentUser.getProfile().getBlockedUserIds().add(userId);
            profileRepository.save(currentUser.getProfile());
        }
        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/{userId}/unblock")
    public ResponseEntity<Void> unblockUser(@PathVariable Long userId, Authentication authentication) {
        User currentUser = (User) authentication.getPrincipal();
        if (currentUser.getProfile() != null) {
            currentUser.getProfile().getBlockedUserIds().remove(userId);
            profileRepository.save(currentUser.getProfile());
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{userId}/public-key")
    public ResponseEntity<Map<String, String>> getPublicKey(@PathVariable Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        String pk = user.getPublicKey() != null ? user.getPublicKey() : "";
        return ResponseEntity.ok(Map.of("publicKey", pk));
    }

    @PutMapping("/profile")
    public ResponseEntity<Map<String, Object>> updateProfile(@RequestBody UpdateProfileRequest request, Authentication authentication) {
        User currentUser = (User) authentication.getPrincipal();
        
        if (currentUser.getProfile() != null) {
            if (request.getFullName() != null) currentUser.getProfile().setFullName(request.getFullName());
            if (request.getBio() != null) currentUser.getProfile().setBio(request.getBio());
            if (request.getStatusMessage() != null) currentUser.getProfile().setStatusMessage(request.getStatusMessage());
            if (request.getAvatarUrl() != null) currentUser.getProfile().setAvatarUrl(request.getAvatarUrl());
            
            profileRepository.save(currentUser.getProfile());
        }
        
        return ResponseEntity.ok(Map.of(
            "id", currentUser.getId(),
            "email", currentUser.getEmail(),
            "fullName", currentUser.getProfile() != null ? currentUser.getProfile().getFullName() : "",
            "bio", currentUser.getProfile() != null && currentUser.getProfile().getBio() != null ? currentUser.getProfile().getBio() : "",
            "statusMessage", currentUser.getProfile() != null && currentUser.getProfile().getStatusMessage() != null ? currentUser.getProfile().getStatusMessage() : "",
            "avatarUrl", currentUser.getProfile() != null && currentUser.getProfile().getAvatarUrl() != null ? currentUser.getProfile().getAvatarUrl() : ""
        ));
    }

    @PutMapping("/privacy")
    public ResponseEntity<Void> updatePrivacySettings(@RequestBody com.nexchat.dto.PrivacySettingsRequest request, Authentication authentication) {
        User currentUser = (User) authentication.getPrincipal();
        
        if (currentUser.getProfile() != null) {
            if (request.getShowLastSeen() != null) currentUser.getProfile().setShowLastSeen(request.getShowLastSeen());
            if (request.getShowOnlineStatus() != null) currentUser.getProfile().setShowOnlineStatus(request.getShowOnlineStatus());
            if (request.getReadReceiptsEnabled() != null) currentUser.getProfile().setReadReceiptsEnabled(request.getReadReceiptsEnabled());
            
            profileRepository.save(currentUser.getProfile());
        }
        
        return ResponseEntity.ok().build();
    }
}
