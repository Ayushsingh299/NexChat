package com.nexchat.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "profiles")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Profile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String fullName;

    private String avatarUrl;
    
    private String bio;

    private String statusMessage;
    
    @Enumerated(EnumType.STRING)
    private OnlineStatus onlineStatus;

    private java.time.LocalDateTime lastSeen;
    
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "blocked_users", joinColumns = @JoinColumn(name = "profile_id"))
    @Column(name = "blocked_user_id")
    private java.util.Set<Long> blockedUserIds = new java.util.HashSet<>();

    @Column(columnDefinition = "boolean default true")
    private boolean showLastSeen = true;

    @Column(columnDefinition = "boolean default true")
    private boolean showOnlineStatus = true;

    @Column(columnDefinition = "boolean default true")
    private boolean readReceiptsEnabled = true;

    @OneToOne
    @JoinColumn(name = "user_id")
    private User user;
}
