package com.nexchat.controller;

import com.nexchat.service.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/files")
@RequiredArgsConstructor
public class FileController {

    @Autowired
    private StorageService storageService;

    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadFile(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }

        try {
            String filename = storageService.uploadFile(file);
            String fileUrl = storageService.getFileUrl(filename);
            
            Map<String, String> response = new HashMap<>();
            response.put("url", fileUrl);
            
            return ResponseEntity.ok(response);
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Could not upload file: " + ex.getMessage()));
        }
    }

    @GetMapping("/{filename}")
    public ResponseEntity<Void> getFile(@PathVariable String filename) {
        String fileUrl = storageService.getFileUrl(filename);
        return ResponseEntity.status(302)
                .header(HttpHeaders.LOCATION, fileUrl)
                .build();
    }
}
