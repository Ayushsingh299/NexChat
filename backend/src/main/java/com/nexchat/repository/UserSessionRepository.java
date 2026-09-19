package com.nexchat.repository;

import com.nexchat.model.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserSessionRepository extends JpaRepository<UserSession, Long> {
    Optional<UserSession> findByTokenId(String tokenId);
    List<UserSession> findByUserId(Long userId);
    void deleteByTokenId(String tokenId);
    void deleteByUserIdAndTokenIdNot(Long userId, String tokenId);
    void deleteAllByUserId(Long userId);
}
