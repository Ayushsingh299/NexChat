package com.nexchat.service;

import org.springframework.web.multipart.MultipartFile;
import java.io.InputStream;

public interface StorageService {
    String uploadFile(MultipartFile file);
    String uploadFile(String filename, InputStream inputStream, String contentType);
    String getFileUrl(String filename);
    void deleteFile(String filename);
}
