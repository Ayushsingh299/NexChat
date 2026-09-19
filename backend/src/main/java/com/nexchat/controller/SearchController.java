package com.nexchat.controller;

import com.nexchat.dto.SearchResponse;
import com.nexchat.model.User;
import com.nexchat.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @GetMapping
    public ResponseEntity<SearchResponse> globalSearch(
            @RequestParam("q") String query,
            Authentication authentication
    ) {
        User currentUser = (User) authentication.getPrincipal();
        if (query == null || query.trim().length() < 2) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(searchService.globalSearch(currentUser.getId(), query.trim()));
    }
}
