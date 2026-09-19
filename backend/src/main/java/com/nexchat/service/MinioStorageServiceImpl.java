package com.nexchat.service;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.http.Method;
import io.minio.MakeBucketArgs;
import io.minio.BucketExistsArgs;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.io.File;
import java.io.InputStream;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class MinioStorageServiceImpl implements StorageService {

    @Autowired
    private MinioClient minioClient;

    @Value("${minio.bucket-name}")
    private String bucketName;

    private boolean useLocal = false;
    private final String uploadDir = "uploads/";

    @PostConstruct
    public void init() {
        try {
            boolean found = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build());
            if (!found) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucketName).build());
            }
        } catch (Exception e) {
            System.err.println("WARNING: MinIO is unavailable (" + e.getMessage() + "). Falling back to local disk storage in 'uploads/' directory.");
            this.useLocal = true;
            File dir = new File(uploadDir);
            if (!dir.exists()) {
                dir.mkdirs();
            }
        }
    }

    @Override
    public String uploadFile(MultipartFile file) {
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        String extension = "";
        int i = originalFilename.lastIndexOf('.');
        if (i >= 0) {
            extension = originalFilename.substring(i);
        }
        String uniqueFilename = UUID.randomUUID().toString() + extension;

        if (useLocal) {
            try {
                Path path = Paths.get(uploadDir + uniqueFilename);
                Files.copy(file.getInputStream(), path, StandardCopyOption.REPLACE_EXISTING);
                return uniqueFilename;
            } catch (Exception e) {
                throw new RuntimeException("Error saving file locally", e);
            }
        }

        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(uniqueFilename)
                            .stream(file.getInputStream(), file.getSize(), -1)
                            .contentType(file.getContentType())
                            .build()
            );
            return uniqueFilename;
        } catch (Exception e) {
            throw new RuntimeException("Error occurred while uploading file to MinIO", e);
        }
    }

    @Override
    public String uploadFile(String filename, InputStream inputStream, String contentType) {
        if (useLocal) {
            try {
                Path path = Paths.get(uploadDir + filename);
                Files.copy(inputStream, path, StandardCopyOption.REPLACE_EXISTING);
                return filename;
            } catch (Exception e) {
                throw new RuntimeException("Error saving file locally", e);
            }
        }

        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(filename)
                            .stream(inputStream, inputStream.available(), -1)
                            .contentType(contentType)
                            .build()
            );
            return filename;
        } catch (Exception e) {
            throw new RuntimeException("Error occurred while uploading file to MinIO", e);
        }
    }

    @Override
    public String getFileUrl(String filename) {
        // Return a public URL assuming bucket policy is public read, or proxy it.
        // For simplicity, we just return the direct URL to the minio server.
        // We will configure MinIO bucket to be public in docker setup.
        if (useLocal) {
            return "/uploads/" + filename;
        }

        try {
            return minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucketName)
                            .object(filename)
                            .expiry(7, TimeUnit.DAYS)
                            .build());
        } catch (Exception e) {
            throw new RuntimeException("Error occurred while generating presigned URL", e);
        }
    }

    @Override
    public void deleteFile(String filename) {
        if (useLocal) {
            try {
                Files.deleteIfExists(Paths.get(uploadDir + filename));
                return;
            } catch (Exception e) {
                throw new RuntimeException("Error deleting file locally", e);
            }
        }

        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(bucketName)
                            .object(filename)
                            .build()
            );
        } catch (Exception e) {
            throw new RuntimeException("Error occurred while deleting file from MinIO", e);
        }
    }
}
